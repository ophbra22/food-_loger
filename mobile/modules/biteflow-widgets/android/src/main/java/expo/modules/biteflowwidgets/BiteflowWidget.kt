package expo.modules.biteflowwidgets
import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
class BiteflowWidget:AppWidgetProvider(){
 override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray){refresh(context)}
 override fun onAppWidgetOptionsChanged(context:Context,manager:AppWidgetManager,id:Int,options:Bundle){refresh(context)}
 override fun onReceive(context:Context,intent:Intent){super.onReceive(context,intent);if(intent.action in setOf("io.github.ophbra22.foodlogger.WIDGET_REFRESH",Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,Intent.ACTION_LOCALE_CHANGED))refresh(context)}
 companion object{
  fun refresh(context:Context){
   val manager=AppWidgetManager.getInstance(context);val ids=manager.getAppWidgetIds(ComponentName(context,BiteflowWidget::class.java))
   if(ids.isEmpty())return
   val locked=(context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isDeviceLocked
   val data=if(!locked&&WidgetStorage.enabled(context))WidgetStorage.get(context).read()else null
   val lines=WidgetPolicy.lines(data,System.currentTimeMillis())
   for(id in ids){
    val view=RemoteViews(context.packageName,R.layout.biteflow_widget)
    listOf(R.id.widget_title,R.id.widget_energy,R.id.widget_protein,R.id.widget_detail,R.id.widget_water,R.id.widget_updated).forEachIndexed{i,v->view.setTextViewText(v,lines[i])}
    view.setViewVisibility(R.id.widget_water,if(manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)>=230)View.VISIBLE else View.GONE)
    view.setInt(R.id.widget_root,"setLayoutDirection",if(data?.optString("language")=="he")View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
    val launch=context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply{action=Intent.ACTION_VIEW;this.data=Uri.parse("foodlogger:///");addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)}
    if(launch!=null)view.setOnClickPendingIntent(R.id.widget_root,PendingIntent.getActivity(context,704,launch,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    view.setContentDescription(R.id.widget_root,lines.filter{it.isNotEmpty()}.joinToString(". "))
    manager.updateAppWidget(id,view)
   }
   val alarm=context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
   val pending=PendingIntent.getBroadcast(context,705,Intent(context,BiteflowWidget::class.java).setAction("io.github.ophbra22.foodlogger.WIDGET_REFRESH"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
   alarm.cancel(pending)
   if(data!=null)alarm.set(AlarmManager.RTC,data.getLong("expires_at"),pending)
  }
 }
}
