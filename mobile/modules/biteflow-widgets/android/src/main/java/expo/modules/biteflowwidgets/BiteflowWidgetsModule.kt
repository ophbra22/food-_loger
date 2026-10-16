package expo.modules.biteflowwidgets
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class BiteflowWidgetsModule:Module(){
 private fun context()=appContext.reactContext?:throw IllegalStateException("Widget context unavailable")
 override fun definition()=ModuleDefinition{
  Name("BiteflowWidgets")
  Function("available"){WidgetStorage.enabled(context())}
  Function("bind"){session:String->val c=context();check(WidgetStorage.enabled(c));WidgetStorage.get(c).bind(session);BiteflowWidget.refresh(c)}
  Function("publish"){session:String,sequence:Double,json:String->val c=context();check(WidgetStorage.enabled(c));require(sequence.isFinite()&&sequence>0&&sequence<=9007199254740991.0&&sequence==sequence.toLong().toDouble());check(WidgetStorage.get(c).publish(session,sequence.toLong(),json)){"Widget session changed"};BiteflowWidget.refresh(c)}
  Function("clear"){val c=context();WidgetStorage.get(c).clear();BiteflowWidget.refresh(c)}
 }
}
