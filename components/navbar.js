import Link from 'next/link'

export default function Navbar() {
  return (
    <nav style={styles.navbar}>
      <h2 style={styles.logo}>AI Business Bot</h2>
      <ul style={styles.menu}>
        <li><Link href="/dashboard">Dashboard</Link></li>
        <li><Link href="/videos">YouTube Automation</Link></li>
        <li><Link href="/store">Print on Demand</Link></li>
        <li><Link href="/affiliate">Affiliate Marketing</Link></li>
        <li><Link href="/analytics">Analytics</Link></li>
        <li><Link href="/settings">Settings</Link></li>
      </ul>
    </nav>
  )
}

const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#111',
    color: '#fff',
  },
  logo: {
    margin: 0,
  },
  menu: {
    display: 'flex',
    listStyle: 'none',
    gap: '1.5rem',
  }
}
