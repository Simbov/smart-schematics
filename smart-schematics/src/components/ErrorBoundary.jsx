import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 p-4 text-sm"
          style={{ color: '#ef4444' }}
        >
          <strong>Something went wrong in {this.props.name || 'this panel'}.</strong>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{String(this.state.error)}</span>
          <button
            className="mt-1 px-3 py-1 rounded text-xs border"
            style={{ color: 'var(--component-color)', borderColor: 'var(--panel-border)' }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
