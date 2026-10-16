import Foundation
final class ProtectedWidgetFile:WidgetFiles {
 private let container:()->URL?
 private let prior:()->Bool
 private let mark:(Bool)throws->Void
 init(container:@escaping()->URL?={
  guard let group=Bundle.main.object(forInfoDictionaryKey:"BiteFlowWidgetsGroup") as? String else{return nil}
  return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:group)
 },prior:@escaping()->Bool={UserDefaults.standard.bool(forKey:"BiteFlowWidgetsMayContainData")},mark:@escaping(Bool)throws->Void={value in
  UserDefaults.standard.set(value,forKey:"BiteFlowWidgetsMayContainData")
  guard UserDefaults.standard.synchronize() else{throw CocoaError(.fileWriteUnknown)}
 }){self.container=container;self.prior=prior;self.mark=mark}
 private func url()throws->URL{guard let root=container()else{throw CocoaError(.fileReadNoPermission)};return root.appendingPathComponent("biteflow-widget-v1.json")}
 func read()throws->Data?{let path=try url();if !FileManager.default.fileExists(atPath:path.path){return nil};return try Data(contentsOf:path)}
 func write(_ data:Data)throws{
  var path=try url()
  // Retain a non-sensitive local marker before a snapshot can reach shared storage.
  try mark(true)
  try data.write(to:path,options:[.atomic,.completeFileProtection]);var values=URLResourceValues();values.isExcludedFromBackup=true;try path.setResourceValues(values)
 }
 func remove()throws{
  guard container() != nil else{if prior(){throw CocoaError(.fileReadNoPermission)};return}
  let path=try url();if FileManager.default.fileExists(atPath:path.path){try FileManager.default.removeItem(at:path)}
  try mark(false)
 }
}
