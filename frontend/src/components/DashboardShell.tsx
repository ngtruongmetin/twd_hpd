import Navbar from './Navbar'

type DashboardShellProps = {
  title: string
}

export default function DashboardShell({ title }: DashboardShellProps) {
  return (
    <main className="vb-page vb-dashboard-page">
      <Navbar />
      <section className="vb-dashboard-empty">
        <div>
          <p className="vb-overline">Dashboard</p>
          <h1>{title}</h1>
          <p>Blank Dashboard</p>
        </div>
      </section>
    </main>
  )
}
