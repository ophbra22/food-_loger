package expo.modules.biteflowhealth

import android.annotation.SuppressLint

import androidx.health.connect.client.records.*
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

// Host JVM tests use the JDK java.time implementation; this is not a device API claim.
@SuppressLint("NewApi")
class HealthPolicyTest {
  @Test fun unsupportedAndroidDoesNotEnterHealthSdk() {
    assertFalse(HealthAvailability.supported(24));assertFalse(HealthAvailability.supported(25))
    assertFalse(HealthAvailability.supported(26));assertFalse(HealthAvailability.supported(27))
    assertTrue(HealthAvailability.supported(28));assertTrue(HealthAvailability.supported(36))
  }
  private val scope = "a".repeat(32)
  private fun item(kind: String = "calories", revision: Int = 1, deleted: Boolean = false) = JSONObject("""{
    "id":"${"b".repeat(32)}","record_key":"meal:${"c".repeat(32)}:$kind",
    "kind":"$kind","unit":"${if(kind == "calories") "kcal" else if(kind == "water") "ml" else "g"}",
    "value":${if(deleted) "null" else "12.5"},"revision":$revision,"deleted":$deleted,
    "start":"2026-10-16T10:00:00Z","end":"2026-10-16T10:00:00Z","timezone_id":"Asia/Jerusalem",
    "local_date":"2026-10-16","provenance":"user_confirmed_unverified"} 
  """)
  @Test fun mapsNutritionWithoutZeroFillingAndPreservesInstantOffset() {
    val r = HealthPolicy.record(scope, item()) as NutritionRecord
    assertEquals(12.5, r.energy!!.inKilocalories, 0.0)
    assertNull(r.protein); assertNull(r.totalFat); assertNull(r.totalCarbohydrate)
    assertEquals(1, java.time.Duration.between(r.startTime, r.endTime).toMillis())
    assertEquals(10800, r.startZoneOffset!!.totalSeconds)
    assertEquals("biteflow:$scope:${"b".repeat(32)}", r.metadata.clientRecordId)
    assertEquals(1, r.metadata.clientRecordVersion)
  }
  @Test fun mapsGramsAndMillilitres() {
    assertEquals(12.5, (HealthPolicy.record(scope,item("protein")) as NutritionRecord).protein!!.inGrams, 0.0)
    val water = item("water").put("record_key", "water:${"c".repeat(32)}").put("provenance","user_entered")
    assertEquals(12.5, (HealthPolicy.record(scope,water) as HydrationRecord).volume.inMilliliters, 0.0)
  }
  @Test fun rejectsWrongUnitsUnknownNutritionAndInconsistentDay() {
    for (bad in listOf(item().put("unit","kJ"),item().put("value",JSONObject.NULL),item().put("local_date","2026-10-15"))) {
      assertThrows(IllegalArgumentException::class.java) { HealthPolicy.record(scope,bad) }
    }
  }
  @Test fun deletesOnlyExactOwnedIdentityAndRejectsStaleReplay() = runBlocking {
    val client = FakeGateway(); val ledger = MemoryLedger(); val gate = SessionGate(); gate.bind("s",scope)
    val engine = HealthEngine(client,ledger,gate)
    engine.apply("s",scope,listOf(item()))
    engine.apply("s",scope,listOf(item(revision=2,deleted=true)))
    engine.apply("s",scope,listOf(item()))
    assertEquals(1, client.written.size); assertEquals(listOf("biteflow:$scope:${"b".repeat(32)}"),client.deleted)
  }
  @Test fun ambiguousDeletionKeepsReceiptPendingButOtherWritesContinue() = runBlocking {
    val client=FakeGateway();val ledger=MemoryLedger();val gate=SessionGate();gate.bind("s",scope)
    val engine=HealthEngine(client,ledger,gate)
    engine.apply("s",scope,listOf(item()))
    client.failDelete=true
    val other=item().put("id","d".repeat(32))
    val first=engine.apply("s",scope,listOf(item(revision=2,deleted=true),other))
    assertEquals(listOf("d".repeat(32)),first.applied);assertEquals(listOf("b".repeat(32)),first.failed)
    val retry=engine.apply("s",scope,listOf(item(revision=2,deleted=true)))
    assertEquals(listOf("b".repeat(32)),retry.failed)
    assertEquals(1L,ledger.values["biteflow:$scope:${"b".repeat(32)}"])
    assertEquals(2,client.written.size)
  }
  @Test fun denialAndSessionStopNeverWriteOrAcknowledge() = runBlocking {
    val client = FakeGateway(); client.granted=emptySet(); val ledger=MemoryLedger(); val gate=SessionGate();gate.bind("s",scope)
    val engine=HealthEngine(client,ledger,gate)
    assertEquals(listOf("b".repeat(32)),engine.apply("s",scope,listOf(item())).failed)
    assertTrue(ledger.values.isEmpty());assertTrue(client.written.isEmpty())
    client.granted=HealthPolicy.permissions.values.toSet();gate.stop("s")
    try { engine.apply("s",scope,listOf(item())); fail() } catch (_: IllegalStateException) { }
    assertTrue(client.written.isEmpty())
  }
  @Test fun failedWriteDoesNotAdvanceAndRetryUsesSameIdentity() = runBlocking {
    val client=FakeGateway();val ledger=MemoryLedger();val gate=SessionGate();gate.bind("s",scope)
    val engine=HealthEngine(client,ledger,gate);client.failWrite=true
    assertEquals(listOf("b".repeat(32)),engine.apply("s",scope,listOf(item())).failed)
    assertTrue(ledger.values.isEmpty());client.failWrite=false
    engine.apply("s",scope,listOf(item()));engine.apply("s",scope,listOf(item()))
    assertEquals(1,client.written.size)
  }
  @Test fun snapshotCapturesTokenBeforeReadAndNeverImportsOwnSource() = runBlocking {
    val client=FakeGateway();val gate=SessionGate();gate.bind("s",scope)
    val page=HealthReader(client,gate).page("s",scope,"weight",null,"2026-09-16T00:00:00Z","2026-10-16T00:00:00Z")
    assertEquals(listOf("token","snapshot"),client.calls)
    assertTrue(page.hasMore);assertEquals("changes",JSONObject(page.nextCursor).getString("stage"))
  }
  @Test fun expiredTokenRestartsSnapshotWithWarning() = runBlocking {
    val client=FakeGateway();client.expired=true;val gate=SessionGate();gate.bind("s",scope)
    val cursor="""{"stage":"changes","kind":"weight","token":"old"}"""
    val page=HealthReader(client,gate).page("s",scope,"weight",cursor,"2026-09-16T00:00:00Z","2026-10-16T00:00:00Z")
    assertTrue(page.recovered);assertEquals(listOf("changes","token","snapshot"),client.calls)
  }
  @Test fun snapshotPagingKeepsCapturedTokenAndWindow() = runBlocking {
    val client=FakeGateway();client.next="page2";val gate=SessionGate();gate.bind("s",scope)
    val reader=HealthReader(client,gate)
    val first=reader.page("s",scope,"steps",null,"2026-09-16T00:00:00Z","2026-10-16T00:00:00Z")
    client.next=null
    val last=reader.page("s",scope,"steps",first.nextCursor,"2026-09-17T00:00:00Z","2026-10-17T00:00:00Z")
    assertEquals(listOf("token","snapshot","snapshot"),client.calls)
    assertEquals("new-token",JSONObject(last.nextCursor).getString("token"))
    assertEquals("2026-09-16T00:00:00Z",client.from)
  }
  @Test fun changeCursorTypeMismatchAndRevokedReadAreRejected() = runBlocking {
    val client=FakeGateway();val gate=SessionGate();gate.bind("s",scope);val reader=HealthReader(client,gate)
    try { reader.page("s",scope,"weight","""{"stage":"changes","kind":"steps","token":"old"}""","2026-09-16T00:00:00Z","2026-10-16T00:00:00Z");fail() } catch (_: IllegalArgumentException) {}
    client.granted=emptySet()
    try { reader.page("s",scope,"weight",null,"2026-09-16T00:00:00Z","2026-10-16T00:00:00Z");fail() } catch (_: SecurityException) {}
    assertTrue(client.calls.isEmpty())
  }
}
private class MemoryLedger: RevisionLedger {
 val values=mutableMapOf<String,Long>()
 override fun revision(id:String)=values[id]?:0L
 override fun save(id:String,revision:Long) {values[id]=revision}
}
private class FakeGateway: HealthGateway {
 var failDelete=false;var granted=HealthPolicy.permissions.values.toSet();var failWrite=false;var expired=false;var next:String?=null;var from=""
 val written=mutableListOf<Record>();val deleted=mutableListOf<String>();val calls=mutableListOf<String>()
 override suspend fun permissions()=granted
 override suspend fun insert(record:Record){if(failWrite)throw java.io.IOException();written.add(record)}
 override suspend fun delete(kind:String,id:String){deleted.add(id);if(failDelete)throw java.io.IOException("deleted but acknowledgement lost / now absent")}
 override suspend fun token(kind:String):String{calls.add("token");return "new-token"}
 override suspend fun snapshot(kind:String,from:String,to:String,page:String?):SnapshotPage {calls.add("snapshot");this.from=from;return SnapshotPage(emptyList(),next)}
 override suspend fun changes(kind:String,token:String):ChangePage {calls.add("changes");return ChangePage(emptyList(),"next-token",false,expired)}
}
