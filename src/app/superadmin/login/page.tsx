import { SignInScreen } from "@/components/auth/SignInScreen";

export default function SuperAdminLoginPage() {
  return (
    <SignInScreen
      basePath="/superadmin/login"
      portal="superadmin"
      badge="Super Admin Portal"
      heading="Super Admin sign in"
      subheading="Enter your super admin credentials to continue."
      showRegister={false}
    />
  );
}
