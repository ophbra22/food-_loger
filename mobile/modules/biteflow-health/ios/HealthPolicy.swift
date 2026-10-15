import Foundation

enum HealthFailure: Error { case unavailable, stale, invalid, denied, overflow }
final class HealthGate: @unchecked Sendable {
 private let lock=NSLock()
 private var token="", owner=""
 func bind(_ session:String,scope:String){lock.lock();defer{lock.unlock()};token=session;owner=scope}
 func stop(_ session:String){lock.lock();defer{lock.unlock()};if token==session{token="";owner=""}}
 func check(_ session:String,scope:String)throws{lock.lock();defer{lock.unlock()};guard !session.isEmpty,session==token,scope==owner,scope.range(of:"^[a-f0-9]{32}$",options:.regularExpression) != nil else{throw HealthFailure.stale}}
}
struct HealthExport: Codable, Sendable {
 let id:String,revision:Int,kind:String,unit:String,value:Double?,start:String,end:String,timezone_id:String,provenance:String,deleted:Bool
 static let units=["calories":"kcal","protein":"g","carbs":"g","fat":"g","water":"ml"]
 static func date(_ value:String)->Date?{
  let f=ISO8601DateFormatter();f.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
  return f.date(from:value) ?? ISO8601DateFormatter().date(from:value)
 }
 func validate()throws{
  guard id.range(of:"^[a-f0-9]{32}$",options:.regularExpression) != nil,revision>0,revision<=9007199254740991,Self.units[kind]==unit,Self.date(start) != nil,start==end,TimeZone(identifier:timezone_id) != nil,["user_confirmed_unverified","user_entered"].contains(provenance),deleted ? value==nil : (value != nil && value!.isFinite && value!>=0) else {throw HealthFailure.invalid}
 }
}
