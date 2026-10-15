import Foundation
@main struct PolicyTests {
 static func main() throws {
  let gate = HealthGate()
  gate.bind("a", scope: String(repeating:"a",count:32))
  try gate.check("a", scope:String(repeating:"a",count:32))
  gate.stop("old")
  try gate.check("a", scope:String(repeating:"a",count:32))
  gate.stop("a")
  do {try gate.check("a", scope:String(repeating:"a",count:32));fatalError("closed session accepted")} catch {}
  gate.bind("b", scope:String(repeating:"b",count:32))
  do {try gate.check("a", scope:String(repeating:"a",count:32));fatalError("old account accepted")} catch {}
  let json="""
  {"id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","revision":1,"kind":"water","unit":"ml","value":250,"start":"2026-10-15T09:00:00+00:00","end":"2026-10-15T09:00:00+00:00","timezone_id":"UTC","provenance":"user_entered","deleted":false}
  """
  let good=try JSONDecoder().decode(HealthExport.self,from:Data(json.utf8));try good.validate()
  for bad in [json.replacingOccurrences(of:"\"revision\":1",with:"\"revision\":0"),json.replacingOccurrences(of:"\"value\":250",with:"\"value\":-1"),json.replacingOccurrences(of:"\"unit\":\"ml\"",with:"\"unit\":\"g\""),json.replacingOccurrences(of:"\"kind\":\"water\"",with:"\"kind\":\"steps\"")]{
   do {try JSONDecoder().decode(HealthExport.self,from:Data(bad.utf8)).validate();fatalError("invalid export accepted")}catch{}
  }
  print("9 native policy cases passed")
 }
}
