// Fungsi ini ngecek: app ini lagi dibuka dari APK yang keinstall, atau dari browser biasa?
export function isRunningAsApk() {
  return document.referrer.startsWith('android-app://')
}
