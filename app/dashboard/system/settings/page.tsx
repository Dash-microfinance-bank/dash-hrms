import SystemChangePasswordForm from "@/components/form/SystemChangePasswordForm";

export default function SettingsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-muted-foreground mt-1 mb-10">
        System and organization settings.
      </p>
    <SystemChangePasswordForm />
    </div>
  )
}
