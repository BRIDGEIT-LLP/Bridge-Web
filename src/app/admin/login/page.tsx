import { SignInScreen } from "@/components/auth/SignInScreen";

export default function AdminLoginPage() {
  return (
    <SignInScreen
      basePath="/admin/login"
      portal="admin"
      badge="Admin Portal"
      heading="Admin sign in"
      subheading="Enter your admin credentials to continue."
      showRegister={false}
    />
  );
}
