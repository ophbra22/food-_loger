import Foundation
@main struct Tests {
 static func main() throws {
  let now=1792152000000.0,session="12345678-1234-1234-1234-123456789012"
  let raw="""
  {"version":1,"date":"2026-10-16","timezone":"UTC","updated_at":1792152000000,"expires_at":1792152900000,"language":"en","state":"ready","calories":400,"calorie_known":400,"calorie_target":2000,"calorie_remaining":1600,"calorie_status":"below_range","protein":20,"protein_known":20,"protein_target":100,"protein_status":"below_target","water":750,"water_target":2000,"partial":false,"logged":true}
  """
  let data=Data(raw.utf8);assert(WidgetPolicy.parse(data,now:now) != nil)
  assert(WidgetPolicy.parse(data,now:now+900001)==nil)
  assert(WidgetPolicy.parse(Data("{}".utf8),now:now)==nil)
  assert(WidgetPolicy.parse(Data(raw.replacingOccurrences(of:"\"version\":1",with:"\"token\":\"secret\",\"version\":1").utf8),now:now)==nil)
  assert(WidgetPolicy.parse(Data(raw.replacingOccurrences(of:"\"calories\":400",with:"\"calories\":-1").utf8),now:now)==nil)
  assert(WidgetPolicy.parse(Data(raw.replacingOccurrences(of:"1792152900000",with:"1792152001000.5").utf8),now:now)==nil)
  let prior=NSTimeZone.default;NSTimeZone.default=TimeZone(identifier:"Asia/Tokyo")!
  let travel=raw.replacingOccurrences(of:"UTC",with:"Pacific/Honolulu").replacingOccurrences(of:"2026-10-16",with:"2026-10-15").replacingOccurrences(of:"1792152000000",with:"1792144500000").replacingOccurrences(of:"1792152900000",with:"1792144800000")
  assert(WidgetPolicy.parse(Data(travel.utf8),now:1792144500000)==nil);NSTimeZone.default=prior
  let files=Files(),store=WidgetStore(files:Files(),now:{now})
  try store.bind(session);try store.publish(session,sequence:1,json:raw);assert(store.read() != nil)
  try store.bind("22345678-1234-1234-1234-123456789012");assert(store.read()==nil);let stale=try store.publish(session,sequence:2,json:raw);assert(!stale)
  let s=WidgetStore(files:files,now:{now});try s.bind(session);try s.publish(session,sequence:2,json:raw);let older=try s.publish(session,sequence:1,json:raw);assert(!older)
  let old=files.data;files.fail=true;do{try s.publish(session,sequence:3,json:raw);assertionFailure()}catch{};assert(files.data==old);files.fail=false
  try s.clear();assert(files.data==nil);let late=try s.publish(session,sequence:4,json:raw);assert(!late)
  files.data=Data("{broken".utf8);assert(s.read()==nil)
  print("PASS: 13 widget policy/storage checks")
 }
}
final class Files:WidgetFiles {
 var data:Data?;var fail=false
 func read() throws ->Data? {data}
 func write(_ value:Data)throws {if fail{throw CocoaError(.fileWriteUnknown)};data=value}
 func remove()throws {if fail{throw CocoaError(.fileWriteUnknown)};data=nil}
}
