package expo.modules.biteflowhealth

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.ZoneId

internal class AndroidHealthGateway(private val client:HealthConnectClient,private val packageName:String):HealthGateway {
  override suspend fun permissions()=client.permissionController.getGrantedPermissions()
  override suspend fun insert(record:Record) {client.insertRecords(listOf(record))}
  override suspend fun delete(kind:String,id:String) {
    require(id.matches(Regex("biteflow:[a-f0-9]{32}:[a-f0-9]{32}")))
    client.deleteRecords(if(kind=="water") HydrationRecord::class else NutritionRecord::class,emptyList(),listOf(id))
  }
  override suspend fun token(kind:String)=client.getChangesToken(ChangesTokenRequest(setOf(if(kind=="weight") WeightRecord::class else StepsRecord::class)))
  override suspend fun snapshot(kind:String,from:String,to:String,page:String?):SnapshotPage {
    val range=TimeRangeFilter.between(Instant.parse(from),Instant.parse(to))
    if(kind=="weight") {
      val r=client.readRecords(ReadRecordsRequest<WeightRecord>(timeRangeFilter=range,pageSize=100,pageToken=page))
      return SnapshotPage(r.records.mapNotNull(::event),r.pageToken)
    }
    val r=client.readRecords(ReadRecordsRequest<StepsRecord>(timeRangeFilter=range,pageSize=100,pageToken=page))
    return SnapshotPage(r.records.mapNotNull(::event),r.pageToken)
  }
  override suspend fun changes(kind:String,token:String):ChangePage {
    val r=client.getChanges(token)
    return ChangePage(r.changes.mapNotNull {
      when(it) {
        is UpsertionChange -> event(it.record)
        is DeletionChange -> mapOf("operation" to "delete","external_id" to it.recordId)
        else -> throw IllegalArgumentException("Unknown Health change")
      }
    },r.nextChangesToken,r.hasMore,r.changesTokenExpired)
  }
  internal fun event(record:Record):Map<String,Any?>? {
    if(record.metadata.dataOrigin.packageName==packageName)return null
    val specific=when(record) {
      is WeightRecord -> mapOf("kind" to "weight","value" to record.weight.inKilograms,"start" to record.time.toString(),"end" to record.time.toString(),"start_offset_seconds" to record.zoneOffset?.totalSeconds,"end_offset_seconds" to record.zoneOffset?.totalSeconds)
      is StepsRecord -> mapOf("kind" to "steps","value" to record.count.toDouble(),"start" to record.startTime.toString(),"end" to record.endTime.toString(),"start_offset_seconds" to record.startZoneOffset?.totalSeconds,"end_offset_seconds" to record.endZoneOffset?.totalSeconds)
      else -> throw IllegalArgumentException("Unselected Health record type")
    }
    return specific+mapOf("operation" to "upsert","external_id" to record.metadata.id,"modified_at" to record.metadata.lastModifiedTime.toString(),"source_bundle" to record.metadata.dataOrigin.packageName,"timezone_id" to ZoneId.systemDefault().id)
  }
}
