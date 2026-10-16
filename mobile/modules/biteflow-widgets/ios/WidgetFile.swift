import Foundation
final class ProtectedWidgetFile:WidgetFiles {
 private func url()throws->URL{
  guard let group=Bundle.main.object(forInfoDictionaryKey:"BiteFlowWidgetsGroup") as? String,let container=FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:group)else{throw CocoaError(.fileReadNoPermission)}
  return container.appendingPathComponent("biteflow-widget-v1.json")
 }
 func read()throws->Data?{let path=try url();if !FileManager.default.fileExists(atPath:path.path){return nil};return try Data(contentsOf:path)}
 func write(_ data:Data)throws{
  var path=try url();try data.write(to:path,options:[.atomic,.completeFileProtection]);var values=URLResourceValues();values.isExcludedFromBackup=true;try path.setResourceValues(values)
 }
 func remove()throws{let path=try url();if FileManager.default.fileExists(atPath:path.path){try FileManager.default.removeItem(at:path)}}
}
