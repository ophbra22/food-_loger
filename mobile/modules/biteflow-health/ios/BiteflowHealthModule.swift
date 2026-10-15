import ExpoModulesCore
import HealthKit

private let kinds:[String:HKQuantityTypeIdentifier] = ["calories":.dietaryEnergyConsumed,"protein":.dietaryProtein,"carbs":.dietaryCarbohydrates,"fat":.dietaryFatTotal,"water":.dietaryWater,"weight":.bodyMass,"steps":.stepCount]
private func quantityType(_ name:String)throws->HKQuantityType{guard let id=kinds[name],let type=HKObjectType.quantityType(forIdentifier:id)else{throw HealthFailure.invalid};return type}
private func unit(_ name:String)->HKUnit{switch name{case "calories":return .kilocalorie();case "water":return .literUnit(with:.milli);case "weight":return .gramUnit(with:.kilo);case "steps":return .count();default:return .gram()}}
private func enabled()->Bool{Bundle.main.object(forInfoDictionaryKey:"BiteFlowHealthEnabled") as? Bool == true && HKHealthStore.isHealthDataAvailable()}
private func permission(_ store:HKHealthStore,_ key:String)->String{guard let type=try? quantityType(key)else{return "denied"};switch store.authorizationStatus(for:type){case .sharingAuthorized:return "authorized";case .sharingDenied:return "denied";default:return "notDetermined"}}

private actor HealthWriter {
 let store=HKHealthStore(),gate:HealthGate
 var tail:Task<Void,Error>?
 init(_ gate:HealthGate){self.gate=gate}
 func apply(_ session:String,_ scope:String,_ text:String)async throws{
  let previous=tail
  let task=Task {try? await previous?.value;try await self.perform(session,scope,text)}
  tail=task;try await task.value
 }
 private func perform(_ session:String,_ scope:String,_ text:String)async throws{
  guard enabled() else{throw HealthFailure.unavailable}
  let row=try JSONDecoder().decode(HealthExport.self,from:Data(text.utf8));try row.validate();try gate.check(session,scope:scope)
  guard permission(store,row.kind)=="authorized" else{throw HealthFailure.denied}
  let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("BiteFlowHealth",isDirectory:true)
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true,attributes:[.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication])
  var resources=URLResourceValues();resources.isExcludedFromBackup=true;var protectedDirectory=directory;try protectedDirectory.setResourceValues(resources)
  let file=directory.appendingPathComponent(scope+".json")
  var versions:[String:Int]=[:]
  if FileManager.default.fileExists(atPath:file.path){versions=try JSONDecoder().decode([String:Int].self,from:Data(contentsOf:file))}
  if let last=versions[row.id],last>=row.revision{return}
  let identity="biteflow:"+scope+":"+row.id,type=try quantityType(row.kind)
  try gate.check(session,scope:scope)
  if row.deleted{
   let predicate=NSCompoundPredicate(andPredicateWithSubpredicates:[HKQuery.predicateForObjects(from:HKSource.default()),HKQuery.predicateForObjects(withMetadataKey:HKMetadataKeySyncIdentifier,allowedValues:[identity])])
   try await withCheckedThrowingContinuation{(continuation:CheckedContinuation<Void,Error>) in
    store.deleteObjects(of:type,predicate:predicate){success,_,error in if let error{continuation.resume(throwing:error)}else if success{continuation.resume()}else{continuation.resume(throwing:HealthFailure.denied)}}
   }
  }else{
   let date=HealthExport.date(row.start)!
   let sample=HKQuantitySample(type:type,quantity:HKQuantity(unit:unit(row.kind),doubleValue:row.value!),start:date,end:date,metadata:[HKMetadataKeySyncIdentifier:identity,HKMetadataKeySyncVersion:row.revision,HKMetadataKeyTimeZone:row.timezone_id,"BiteFlowProvenance":row.provenance])
   try await withCheckedThrowingContinuation{(continuation:CheckedContinuation<Void,Error>) in
    store.save(sample){success,error in if let error{continuation.resume(throwing:error)}else if success{continuation.resume()}else{continuation.resume(throwing:HealthFailure.denied)}}
   }
  }
  // An operation already handed to HealthKit can finish after sign-out. Record
  // its revision under its original anonymous scope; never start the next one.
  versions[row.id]=row.revision
  try JSONEncoder().encode(versions).write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
 }
}

public class BiteflowHealthModule: Module {
 private let gate=HealthGate()
 private lazy var writer=HealthWriter(gate)
 private let store=HKHealthStore()
 public func definition()->ModuleDefinition{
  Name("BiteflowHealth")
  Function("bind"){(session:String,scope:String) in self.gate.bind(session,scope:scope)}
  Function("stop"){(session:String) in self.gate.stop(session)}
  AsyncFunction("status"){()->[String:Any] in
   var writes:[String:String]=[:];if enabled(){for key in HealthExport.units.keys{writes[key]=permission(self.store,key)}}
   return ["available":enabled(),"read":"unknown","write":writes]
  }
  AsyncFunction("authorize"){(choices:[String:Bool]) async throws in
   guard enabled()else{throw HealthFailure.unavailable}
   var read=Set<HKObjectType>(),write=Set<HKSampleType>()
   if choices["nutrition"]==true{for key in ["calories","protein","carbs","fat"]{write.insert(try quantityType(key))}}
   if choices["water"]==true{write.insert(try quantityType("water"))}
   for key in ["weight","steps"] where choices[key]==true{read.insert(try quantityType(key))}
   if read.isEmpty && write.isEmpty{throw HealthFailure.invalid}
   try await withCheckedThrowingContinuation{(continuation:CheckedContinuation<Void,Error>) in
    self.store.requestAuthorization(toShare:write,read:read){success,error in if let error{continuation.resume(throwing:error)}else if success{continuation.resume()}else{continuation.resume(throwing:HealthFailure.denied)}}
   }
  }
  AsyncFunction("apply"){(session:String,scope:String,text:String) async throws in try await self.writer.apply(session,scope,text)}
  AsyncFunction("read"){(session:String,scope:String,choices:[String:Bool],from:String,to:String)async throws -> [[String:Any]] in
   guard enabled(),let start=HealthExport.date(from),let end=HealthExport.date(to),end>=start,end.timeIntervalSince(start)<=31*86400 else{throw HealthFailure.invalid}
   var output:[[String:Any]]=[]
   for key in ["weight","steps"] where choices[key]==true{
    try self.gate.check(session,scope:scope)
    let predicate=NSCompoundPredicate(andPredicateWithSubpredicates:[HKQuery.predicateForSamples(withStart:start,end:end,options:.strictStartDate),NSCompoundPredicate(notPredicateWithSubpredicate:HKQuery.predicateForObjects(from:HKSource.default()))])
    let rows:[HKQuantitySample]=try await withCheckedThrowingContinuation{continuation in
     let query=HKSampleQuery(sampleType:try! quantityType(key),predicate:predicate,limit:1001,sortDescriptors:[NSSortDescriptor(key:HKSampleSortIdentifierStartDate,ascending:true)]){_,samples,error in
      if let error{continuation.resume(throwing:error)}else{continuation.resume(returning:(samples as? [HKQuantitySample]) ?? [])}
     };self.store.execute(query)
    }
    try self.gate.check(session,scope:scope)
    if rows.count>1000{throw HealthFailure.overflow}
    for row in rows{
     let zone=row.metadata?[HKMetadataKeyTimeZone] as? String ?? "UTC"
     output.append(["external_id":row.uuid.uuidString.lowercased(),"kind":key,"value":row.quantity.doubleValue(for:unit(key)),"start":ISO8601DateFormatter().string(from:row.startDate),"end":ISO8601DateFormatter().string(from:row.endDate),"source_bundle":row.sourceRevision.source.bundleIdentifier,"timezone_id":TimeZone(identifier:zone)==nil ? "UTC":zone])
    }
   }
   return output
  }
 }
}
