import { useEffect } from "react"

export default function ProfilePage() {
  useEffect(() => {
    window.location.href = "http://dev-idp.blocksdevelopers.com/profile"
  }, [])

  return null
}
