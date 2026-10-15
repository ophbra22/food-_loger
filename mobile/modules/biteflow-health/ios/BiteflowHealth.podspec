Pod::Spec.new do |s|
  s.name           = 'BiteflowHealth'
  s.version        = '1.0.0'
  s.summary        = 'Private BiteFlow HealthKit adapter'
  s.description    = 'Owner scoped, foreground HealthKit integration'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks = 'HealthKit'
  s.swift_version = '5.9'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
