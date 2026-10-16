package expo.modules.biteflowwidgets
import android.content.Context
import android.util.AtomicFile
import java.io.File
internal class PrivateWidgetFiles(context:Context):WidgetFiles{
 private val file=AtomicFile(File(context.noBackupFilesDir,"biteflow-widget-v1.json"))
 override fun read():String?=if(file.baseFile.exists())file.openRead().use{it.readBytes().toString(Charsets.UTF_8)}else null
 override fun write(value:String){val output=file.startWrite();try{output.write(value.toByteArray());file.finishWrite(output)}catch(e:Exception){file.failWrite(output);throw e}}
 override fun remove(){file.delete();check(!file.baseFile.exists()){ "Widget clear failed" }}
}
internal object WidgetStorage{
 private var store:WidgetStore?=null
 @Synchronized fun get(context:Context):WidgetStore=store?:WidgetStore(PrivateWidgetFiles(context.applicationContext)).also{store=it}
 fun enabled(context:Context)=context.packageManager.getApplicationInfo(context.packageName,android.content.pm.PackageManager.GET_META_DATA).metaData?.getBoolean("BiteFlowWidgetsEnabled",false)==true
}
