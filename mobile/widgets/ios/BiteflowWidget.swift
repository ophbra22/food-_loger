import SwiftUI
import WidgetKit
struct BiteflowEntry:TimelineEntry {let date:Date;let snapshot:[String:Any]?}
struct BiteflowProvider:TimelineProvider {
 func placeholder(in context:Context)->BiteflowEntry{BiteflowEntry(date:Date(),snapshot:nil)}
 private func current()->BiteflowEntry{
  let enabled=Bundle.main.object(forInfoDictionaryKey:"BiteFlowWidgetsEnabled") as? Bool == true
  return BiteflowEntry(date:Date(),snapshot:enabled ? WidgetStore(files:ProtectedWidgetFile()).read():nil)
 }
 func getSnapshot(in context:Context,completion:@escaping(BiteflowEntry)->Void){completion(context.isPreview ? placeholder(in:context):current())}
 func getTimeline(in context:Context,completion:@escaping(Timeline<BiteflowEntry>)->Void){
  let entry=current();guard let expiry=WidgetPolicy.number(entry.snapshot?["expires_at"]),expiry>Date().timeIntervalSince1970*1000 else{completion(Timeline(entries:[entry],policy:.after(Date().addingTimeInterval(900))));return}
  let expires=Date(timeIntervalSince1970:expiry/1000)
  completion(Timeline(entries:[entry,BiteflowEntry(date:expires,snapshot:nil)],policy:.after(expires)))
 }
}
struct BiteflowView:View {
 @Environment(\.widgetFamily) var family
 let entry:BiteflowEntry
 var body:some View{
  let lines=WidgetPolicy.lines(entry.snapshot)
  VStack(alignment:.leading,spacing:4){
   Text(lines[0]).font(.caption2).foregroundStyle(Color(red:0.78,green:0.86,blue:0.79)).lineLimit(1)
   Text(lines[1]).font(.title3.bold()).lineLimit(2).minimumScaleFactor(0.7)
   Text(lines[2]).font(.caption).lineLimit(2)
   Text(lines[3]).font(.caption2).lineLimit(2)
   if family == .systemMedium {Text(lines[4]).font(.caption)}
   Spacer(minLength:0)
   Text(lines[5]).font(.caption2).foregroundStyle(.secondary)
  }.frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.leading).foregroundStyle(Color.white)
   .environment(\.layoutDirection,entry.snapshot?["language"] as? String == "he" ? .rightToLeft:.leftToRight)
   .privacySensitive().widgetURL(URL(string:"foodlogger:///"))
   .accessibilityElement(children:.combine)
 }
}
@main struct BiteflowToday:Widget {
 let kind="BiteflowToday"
 var body:some WidgetConfiguration {
  StaticConfiguration(kind:kind,provider:BiteflowProvider()){entry in
   if #available(iOS 17.0,*){BiteflowView(entry:entry).containerBackground(Color(red:0.078,green:0.145,blue:0.114),for:.widget)}
   else{BiteflowView(entry:entry).padding().background(Color(red:0.078,green:0.145,blue:0.114))}
  }.configurationDisplayName("BiteFlow Today").description("Today’s nutrition and water. Open BiteFlow to refresh.").supportedFamilies([.systemSmall,.systemMedium])
 }
}
