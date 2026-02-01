<script lang="ts">
  import { goto } from '$app/navigation';
  
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  
  async function handleLogin() {
    if (!email || !password) {
      error = 'Please enter email and password';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error = data.error || 'Login failed';
        return;
      }
      
      // Redirect to main app
      goto('/');
    } catch (e) {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }
</script>

<svelte:head>
  <title>Login - Filing System</title>
</svelte:head>

<div class="login-container">
  <div class="login-box">
    <div class="login-header">
      <h1>Filing System</h1>
      <p>Sign in to continue</p>
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <div class="form-group">
      <label for="email">Email</label>
      <input 
        type="email" 
        id="email" 
        bind:value={email} 
        on:keydown={handleKeydown}
        placeholder="Enter your email"
        disabled={loading}
      />
    </div>
    
    <div class="form-group">
      <label for="password">Password</label>
      <input 
        type="password" 
        id="password" 
        bind:value={password} 
        on:keydown={handleKeydown}
        placeholder="Enter your password"
        disabled={loading}
      />
    </div>
    
    <button class="login-btn" on:click={handleLogin} disabled={loading}>
      {loading ? 'Signing in...' : 'Sign In'}
    </button>
    
    <a href="/forgot-password" class="forgot-link">Forgot password?</a>
    
    <div class="signup-link">
      Don't have an account? <a href="/signup">Sign up</a>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1b26;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .login-box {
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 8px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .login-header h1 {
    color: #c0caf5;
    font-size: 24px;
    margin: 0 0 8px 0;
  }
  
  .login-header p {
    color: #565f89;
    margin: 0;
    font-size: 14px;
  }
  
  .error-message {
    background: rgba(247, 118, 142, 0.15);
    border: 1px solid #f7768e;
    color: #f7768e;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 13px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    color: #7aa2f7;
    font-size: 12px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .form-group input {
    width: 100%;
    padding: 12px;
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 14px;
    box-sizing: border-box;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .form-group input::placeholder {
    color: #565f89;
  }
  
  .login-btn {
    width: 100%;
    padding: 14px;
    background: #7aa2f7;
    color: #1a1b26;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .login-btn:hover:not(:disabled) {
    background: #89b4fa;
  }
  
  .login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .forgot-link {
    display: block;
    text-align: center;
    margin-top: 16px;
    color: #565f89;
    font-size: 12px;
    text-decoration: none;
  }
  
  .forgot-link:hover {
    color: #7aa2f7;
  }
  
  .signup-link {
    text-align: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #3b4261;
    color: #565f89;
    font-size: 13px;
  }
  
  .signup-link a {
    color: #9ece6a;
    text-decoration: none;
  }
  
  .signup-link a:hover {
    text-decoration: underline;
  }
</style>
