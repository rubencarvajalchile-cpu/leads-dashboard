import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#e7e8e2]">Panel de atención</h1>
          <p className="mt-2 text-muted-foreground">Ingresa para revisar tus resultados y conversaciones</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
