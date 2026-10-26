require 'xcodeproj'
root = File.expand_path('..', __dir__)
project = Xcodeproj::Project.new(File.join(root, 'FrameLedger.xcodeproj'))
target = project.new_target(:application, 'FrameLedger', :ios, '18.0')
group = project.main_group.new_group('Sources')
Dir[File.join(root, 'FrameLedger/Sources/*.swift'), File.join(root, 'FrameLedgerCore/Sources/FrameLedgerCore/*.swift')].each { |file| target.source_build_phase.add_file_reference(group.new_file(file.delete_prefix(root + '/'))) }
target.resources_build_phase.add_file_reference(group.new_file('FrameLedger/Assets.xcassets'))
target.resources_build_phase.add_file_reference(group.new_file('FrameLedger/PrivacyInfo.xcprivacy'))
target.build_configurations.each do |config|
  config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.royzmediagroup.frameledger.preview'
  config.build_settings['SWIFT_VERSION'] = '6.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['INFOPLIST_KEY_UILaunchScreen_Generation'] = 'YES'
  config.build_settings['INFOPLIST_KEY_UIApplicationSceneManifest_Generation'] = 'YES'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['INFOPLIST_KEY_UISupportedInterfaceOrientations'] = 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight'
  config.build_settings['INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad'] = 'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['CODE_SIGNING_ALLOWED[sdk=iphonesimulator*]'] = 'NO'
  config.build_settings['INFOPLIST_KEY_ITSAppUsesNonExemptEncryption'] = 'NO'
  config.build_settings['INFOPLIST_KEY_CFBundleDisplayName'] = 'FrameLedger'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['MARKETING_VERSION'] = '0.1.0'
  config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'complete'
end
ui = project.new_target(:ui_test_bundle, 'FrameLedgerUITests', :ios, '18.0')
ui.add_dependency(target)
ui.source_build_phase.add_file_reference(group.new_file('FrameLedgerUITests/FrameLedgerUITests.swift'))
ui.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.royzmediagroup.frameledger.preview.uitests'
  config.build_settings['SWIFT_VERSION'] = '6.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['TEST_TARGET_NAME'] = 'FrameLedger'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.set_launch_target(target)
scheme.add_test_target(ui)
scheme.save_as(project.path, 'FrameLedger', true)
