import Foundation
@main struct FileTests {
 static func main() throws {
  // Host test bundle has no widget group: fresh/unavailable must not block ordinary use.
  try ProtectedWidgetFile().remove()
  var marked=true
  let prior=ProtectedWidgetFile(container:{nil},prior:{marked},mark:{marked=$0})
  do{try prior.remove();assertionFailure("Prior data must retain privacy gate")}catch{}
  let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString);try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:root)}
  let restored=ProtectedWidgetFile(container:{root},prior:{marked},mark:{marked=$0})
  try Data("synthetic".utf8).write(to:root.appendingPathComponent("biteflow-widget-v1.json"));try restored.remove();assert(!marked);assert(!FileManager.default.fileExists(atPath:root.appendingPathComponent("biteflow-widget-v1.json").path))
  print("PASS: 3 capability/clear checks — fresh unavailable storage permits ordinary app cleanup")
 }
}
