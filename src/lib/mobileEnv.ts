export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isSecureContextForGeo(): boolean {
  if (typeof window === 'undefined') return true
  // localhost는 예외적으로 secure context로 취급됨
  if (window.location.hostname === 'localhost') return true
  return window.isSecureContext === true
}


