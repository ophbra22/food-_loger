from pathlib import Path
import plistlib
p=Path('mobile/ios/BiteflowWidgets/Info.plist')
d=plistlib.loads(p.read_bytes())
assert isinstance(d.get('CFBundleName'),str) and d['CFBundleName'], 'Missing required CFBundleName'
assert d['NSExtension']['NSExtensionPointIdentifier']=='com.apple.widgetkit-extension'
print('PASS: generated WidgetKit extension installation metadata')
