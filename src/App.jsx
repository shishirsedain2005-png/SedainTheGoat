function App() {
  return (
    <div className="app">
      <div className="card">
        <h1>Hello from CI/CD!</h1>
        <p>This React app is automatically deployed to EC2 via GitHub Actions.</p>
        <p>Push any change to the <code>main</code> branch and watch it go live.</p>
        <div className="badge">Techspire College 2026</div>
      </div>
    </div>
  )
}

export default App
