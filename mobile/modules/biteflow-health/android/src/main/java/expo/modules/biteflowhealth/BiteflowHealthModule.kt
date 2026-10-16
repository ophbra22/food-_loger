package expo.modules.biteflowhealth

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.AtomicFile
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.Serializable
import org.json.JSONArray
import org.json.JSONObject

private data class PermissionInput(val permissions:HashSet<String>):Serializable
private class HealthPermissionContract:AppContextActivityResultContract<PermissionInput,Set<String>> {
  private val contract=PermissionController.createRequestPermissionResultContract()
  override fun createIntent(context:Context,input:PermissionInput)=contract.createIntent(context,input.permissions)
  override fun parseResult(input:PermissionInput,resultCode:Int,intent:Intent?)=contract.parseResult(resultCode,intent)
}
private class FileLedger(context:Context):RevisionLedger {
  private val file=AtomicFile(File(context.noBackupFilesDir,"biteflow-health-connect-revisions.json"))
  private val values=if(file.baseFile.exists())JSONObject(file.openRead().use {it.readBytes().toString(Charsets.UTF_8)}) else JSONObject()
  override fun revision(id:String)=values.optLong(id,0)
  override fun save(id:String,revision:Long) {
    val next=JSONObject(values.toString()).put(id,revision)
    val stream=file.startWrite()
    try {stream.write(next.toString().toByteArray());file.finishWrite(stream);values.put(id,revision)}
    catch(e:Exception){file.failWrite(stream);throw e}
  }
}
class BiteflowHealthModule:Module() {
  private val context get()=requireNotNull(appContext.reactContext)
  private val gate=SessionGate()
  private lateinit var launcher:AppContextActivityResultLauncher<PermissionInput,Set<String>>
  private val gateway by lazy {if(Build.VERSION.SDK_INT<28)throw IllegalStateException("Health Connect requires API28");AndroidHealthGateway(HealthConnectClient.getOrCreate(context),context.packageName)}
  private val engine by lazy {HealthEngine(gateway,FileLedger(context),gate)}
  private val reader by lazy {HealthReader(gateway,gate)}
  private fun enabled()=context.packageManager.getApplicationInfo(context.packageName,PackageManager.GET_META_DATA).metaData?.getBoolean("BiteFlowHealthConnectEnabled",false)==true
  private fun sdk()=if(HealthAvailability.supported(Build.VERSION.SDK_INT)&&enabled())HealthConnectClient.getSdkStatus(context) else 1
  private fun requireAvailable(){check(sdk()==HealthConnectClient.SDK_AVAILABLE){"Health Connect unavailable"}}
  override fun definition()=ModuleDefinition {
    Name("BiteflowHealth")
    RegisterActivityContracts {if(HealthAvailability.supported(Build.VERSION.SDK_INT))launcher=registerForActivityResult(HealthPermissionContract()){_,_-> /* Interrupted consent is never persisted. */ }}
    Function("bind") {session:String,scope:String -> requireAvailable();gate.bind(session,scope)}
    Function("stop") {session:String -> gate.stop(session)}
    AsyncFunction("status") Coroutine { ->
      if(Build.VERSION.SDK_INT<28||!enabled())return@Coroutine HealthAvailability.unavailable()
      val status=sdk();val available=status==HealthConnectClient.SDK_AVAILABLE
      val granted=if(available)gateway.permissions() else emptySet()
      mapOf("available" to available,"read" to "unknown",
        "availability" to if(available) "available" else if(status==HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) "install_required" else "unavailable",
        "readGranted" to mapOf("weight" to (HealthPolicy.permissions["weight"] in granted),"steps" to (HealthPolicy.permissions["steps"] in granted)),
        "write" to listOf("calories","protein","carbs","fat","water").associateWith {if(HealthPolicy.writePermission(it) in granted)"authorized" else "denied"})
    }
    AsyncFunction("authorize") Coroutine {choices:Map<String,Boolean> ->
      requireAvailable();require(choices.keys==HealthPolicy.permissions.keys)
      launcher.launch(PermissionInput(HashSet(choices.filterValues {it}.keys.map {HealthPolicy.permissions[it]!!})))
      Unit
    }
    AsyncFunction("manage") { ->
      check(enabled()&&HealthAvailability.supported(Build.VERSION.SDK_INT))
      val intent=if(sdk()==HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
        Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id=com.google.android.apps.healthdata"))
      else Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("applyBatch") Coroutine {session:String,scope:String,json:String ->
      if(Build.VERSION.SDK_INT<28)throw IllegalStateException("Health Connect requires API28")
      requireAvailable();require(json.length<=200000);val rows=JSONArray(json)
      engine.apply(session,scope,(0 until rows.length()).map {rows.getJSONObject(it)}).bridge()
    }
    AsyncFunction("readPage") Coroutine {session:String,scope:String,kind:String,cursor:String?,from:String,to:String ->
      if(Build.VERSION.SDK_INT<28)throw IllegalStateException("Health Connect requires API28")
      requireAvailable();reader.page(session,scope,kind,cursor,from,to).bridge()
    }
  }
}
