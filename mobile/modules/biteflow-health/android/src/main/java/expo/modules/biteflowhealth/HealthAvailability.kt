package expo.modules.biteflowhealth

/** SDK code is never entered on API24–27; ordinary logging keeps its API24 minimum. */
internal object HealthAvailability {
  fun supported(api:Int)=api>=28
  fun unavailable()=mapOf("available" to false,"availability" to "unavailable","read" to "unknown","write" to emptyMap<String,String>(),"readGranted" to mapOf("weight" to false,"steps" to false))
}
