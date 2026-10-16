import Foundation
import CoreFoundation

enum WidgetPolicy {
 static let ttl=900000.0
 static let numeric:Set<String>=["calories","calorie_known","calorie_target","calorie_remaining","protein","protein_known","protein_target","water","water_target"]
 static let keys=numeric.union(["version","date","timezone","updated_at","expires_at","language","state","calorie_status","protein_status","partial","logged"])
 static let statuses:Set<String>=["unknown","no_goal","unlogged","partial","below_range","above_range","in_range","met","below_target"]
 static func session(_ s:String)->Bool{s.range(of:"^[a-fA-F0-9-]{36}$",options:.regularExpression) != nil}
 static func number(_ v:Any?)->Double?{guard let n=v as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.isFinite else{return nil};return n.doubleValue}
 static func parse(_ data:Data,now:Double)->[String:Any]? {
  guard data.count<=8192,let d=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],Set(d.keys)==keys,number(d["version"])==1,
   let language=d["language"] as? String,["en","he"].contains(language),let state=d["state"] as? String,["ready","unavailable"].contains(state),
   let partial=d["partial"] as? NSNumber,CFGetTypeID(partial)==CFBooleanGetTypeID(),let logged=d["logged"] as? NSNumber,CFGetTypeID(logged)==CFBooleanGetTypeID(),
   let cs=d["calorie_status"] as? String,statuses.contains(cs),let ps=d["protein_status"] as? String,statuses.contains(ps),
   let updated=number(d["updated_at"]),let expires=number(d["expires_at"]),updated>=0,updated.rounded()==updated,expires.rounded()==expires,expires<=9007199254740991,updated<=now+1000,expires>now,expires>updated,expires<=updated+ttl,
   let zone=d["timezone"] as? String,let tz=TimeZone(identifier:zone),let date=d["date"] as? String else{return nil}
  let format=DateFormatter();format.locale=Locale(identifier:"en_US_POSIX");format.timeZone=tz;format.dateFormat="yyyy-MM-dd"
  guard format.string(from:Date(timeIntervalSince1970:now/1000))==date,format.string(from:Date(timeIntervalSince1970:updated/1000))==date else{return nil}
  format.timeZone=TimeZone.current
  guard format.string(from:Date(timeIntervalSince1970:now/1000))==date,format.string(from:Date(timeIntervalSince1970:updated/1000))==date else{return nil}
  for key in numeric {if d[key] is NSNull{continue};guard let n=number(d[key]),abs(n)<=100000000,(key=="calorie_remaining"||n>=0),state=="ready" else{return nil}}
  if state=="ready" && (d["calorie_known"] is NSNull || d["protein_known"] is NSNull){return nil}
  if (d["calories"] is NSNull || d["calorie_target"] is NSNull) && !(d["calorie_remaining"] is NSNull){return nil}
  return d
 }
 static func lines(_ d:[String:Any]?)->[String]{
  let he=d?["language"] as? String == "he"
  guard let d=d,d["state"] as? String == "ready" else{return ["BiteFlow",he ? "פתחו לרענון היום":"Open to refresh Today","","","",""]}
  func n(_ k:String)->String{guard let v=number(d[k]) else{return "—"};return String(format:"%.0f",locale:Locale(identifier:"en_US_POSIX"),v)}
  let energy:String
  if d["logged"] as? Bool == false{energy=he ? "לא נרשמו ארוחות":"No meals logged"}
  else if d["calories"] is NSNull{energy=he ? "חלקי: לפחות \(n("calorie_known")) קק״ל":"Partial: at least \(n("calorie_known")) kcal"}
  else{energy="\(n("calories")) "+(he ? "קק״ל":"kcal")}
  let protein:String
  if d["protein"] is NSNull{protein=he ? "חלבון חלקי: לפחות \(n("protein_known")) ג׳":"Partial protein: at least \(n("protein_known")) g"}
  else{protein=(he ? "חלבון ":"Protein ")+n("protein")+(d["protein_target"] is NSNull ? " g":" / \(n("protein_target")) g")}
  let detail:String
  switch d["calorie_status"] as? String {
   case "unknown":detail=he ? "היעד לא זמין":"Goal unavailable"
   case "no_goal":detail=he ? "ללא יעד קלורי":"No calorie goal"
   case "partial":detail=he ? "הנותר לא ידוע":"Remaining unknown"
   case "unlogged":detail=he ? "טרם נרשמו ארוחות":"No meals logged"
   default:
    let status=d["calorie_status"] as? String == "in_range" ? (he ? "בטווח":"in range") : d["calorie_status"] as? String == "above_range" ? (he ? "מעל הטווח":"above range") : (he ? "מתחת לטווח":"below range")
    detail=(he ? "נותרו ":"Remaining ")+n("calorie_remaining")+" kcal · "+status
  }
  let water=(he ? "מים ":"Water ")+n("water")+(d["water_target"] is NSNull ? " ml":" / \(n("water_target")) ml")
  let f=DateFormatter();f.locale=Locale(identifier:"en_US_POSIX");f.timeZone=TimeZone(identifier:d["timezone"] as? String ?? "UTC");f.dateFormat="HH:mm"
  return ["BiteFlow · "+(d["date"] as? String ?? ""),energy,protein,detail,water,(he ? "עודכן ":"Updated ")+f.string(from:Date(timeIntervalSince1970:(number(d["updated_at"]) ?? 0)/1000))]
 }
}
protocol WidgetFiles {func read()throws->Data?;func write(_ data:Data)throws;func remove()throws}
final class WidgetStore {
 private let files:WidgetFiles;private let now:()->Double;private let lock=NSRecursiveLock();private var session:String?;private var sequence=0.0
 init(files:WidgetFiles,now:@escaping()->Double={Date().timeIntervalSince1970*1000}){self.files=files;self.now=now}
 func bind(_ value:String)throws {lock.lock();defer{lock.unlock()};guard WidgetPolicy.session(value)else{throw CocoaError(.fileWriteInvalidFileName)};try clear();session=value}
 func clear()throws {lock.lock();defer{lock.unlock()};session=nil;sequence=0;try files.remove()}
 @discardableResult func publish(_ value:String,sequence revision:Double,json:String)throws->Bool{
  lock.lock();defer{lock.unlock()};guard value==session,revision>sequence else{return false}
  guard revision.isFinite,revision.rounded()==revision,revision<=9007199254740991,let d=WidgetPolicy.parse(Data(json.utf8),now:now())else{throw CocoaError(.fileWriteInapplicableStringEncoding)}
  let data=try JSONSerialization.data(withJSONObject:["session":value,"sequence":revision,"snapshot":d]);try files.write(data);sequence=revision;return true
 }
 func read()->[String:Any]?{
  lock.lock();defer{lock.unlock()}
  guard let data=try? files.read(),data.count<=10000,let d=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],Set(d.keys)==["session","sequence","snapshot"],let session=d["session"] as? String,WidgetPolicy.session(session),(WidgetPolicy.number(d["sequence"]) ?? 0)>0,let snapshot=d["snapshot"] as? [String:Any],let raw=try? JSONSerialization.data(withJSONObject:snapshot)else{return nil}
  return WidgetPolicy.parse(raw,now:now())
 }
}
