<script lang="ts">
  let email = '';
  let error = '';
  let success = false;
  let loading = false;
  let devToken = ''; // For development testing
  
  async function handleSubmit() {
    if (!email) {
      error = 'Please enter your email';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error = data.error || 'Failed to send reset email';
        return;
      }
      
      success = true;
      // DEV: capture token for testing
      if (data._devToken) {
        devToken = data._devToken;
      }
    } catch (e) {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }
</script>

<svelte:head>
  <title>Forgot Password - Filing System</title>
</svelte:head>

<div class="forgot-container">
  <div class="forgot-box">
    <div class="forgot-header">
      <h1>Reset Password</h1>
      <p>Enter your email to receive a reset link</p>
    </div>
    
    {#if success}
      <div class="success-message">
        <p>If an account exists with that email, you'll receive a password reset link.</p>
        <p class="check-email">Check your email inbox.</p>
        
        {#if devToken}
          <div class="dev-notice">
            <strong>DEV MODE:</strong> 
            <a href="/reset-password?token={devToken}">Click here to reset password</a>
          </div>
        {/if}
      </div>
      <a href="/login" class="back-link">← Back to login</a>
    {:else}
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <div class="form-group">
        <label for="email">Email Address</label>
        <input 
          type="email" 
          id="email" 
          bind:value={email} 
          on:keydown={handleKeydown}
          placeholder="Enter your email"
          disabled={loading}
        />
      </div>
      
      <button class="submit-btn" on:click={handleSubmit} disabled={loading}>
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>
      
      <div class="login-link">
        Remember your password? <a href="/login">Sign in</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .forgot-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1b26;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .forgot-box {
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 8px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .forgot-header {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .forgot-header h1 {
    color: #c0caf5;
    font-size: 24px;
    margin: 0 0 8px 0;
  }
  
  .forgot-header p {
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
  
  .success-message {
    background: rgba(158, 206, 106, 0.15);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 16px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 13px;
    text-align: center;
  }
  
  .success-message p {
    margin: 0 0 8px 0;
  }
  
  .check-email {
    font-weight: bold;
  }
  
  .dev-notice {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(158, 206, 106, 0.3);
    font-size: 11px;
    color: #e0af68;
  }
  
  .dev-notice a {
    color: #7aa2f7;
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
  
  .submit-btn {
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
  
  .submit-btn:hover:not(:disabled) {
    background: #89b4fa;
  }
  
  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .login-link, .back-link {
    display: block;
    text-align: center;
    margin-top: 20px;
    color: #565f89;
    font-size: 13px;
    text-decoration: none;
  }
  
  .login-link a, .back-link {
    color: #7aa2f7;
    text-decoration: none;
  }
  
  .login-link a:hover, .back-link:hover {
    text-decoration: underline;
  }
</style>
