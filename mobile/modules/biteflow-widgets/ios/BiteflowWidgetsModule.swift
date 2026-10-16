import ExpoModulesCore
import WidgetKit
public class BiteflowWidgetsModule:Module {
 private let store=WidgetStore(files:ProtectedWidgetFile())
 private var enabled:Bool{Bundle.main.object(forInfoDictionaryKey:"BiteFlowWidgetsEnabled") as? Bool == true}
 private func reload(){WidgetCenter.shared.reloadTimelines(ofKind:"BiteflowToday")}
 public func definition()->ModuleDefinition{
  Name("BiteflowWidgets")
  Function("available"){()->Bool in self.enabled && FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:Bundle.main.object(forInfoDictionaryKey:"BiteFlowWidgetsGroup") as? String ?? "") != nil}
  Function("bind"){(session:String)throws in guard self.enabled else{throw CocoaError(.featureUnsupported)};try self.store.bind(session);self.reload()}
  Function("publish"){(session:String,sequence:Double,json:String)throws in guard self.enabled,try self.store.publish(session,sequence:sequence,json:json)else{throw CocoaError(.fileWriteNoPermission)};self.reload()}
  Function("clear"){()throws in try self.store.clear();self.reload()}
 }
}
