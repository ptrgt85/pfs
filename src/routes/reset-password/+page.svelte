<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let password = '';
  let confirmPassword = '';
  let error = '';
  let loading = false;
  
  $: token = $page.url.searchParams.get('token') || '';
  
  async function handleReset() {
    error = '';
    
    if (!password) {
      error = 'Please enter a new password';
      return;
    }
    
    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    if (!token) {
      error = 'Invalid reset link';
      return;
    }
    
    loading = true;
    
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error = data.error || 'Failed to reset password';
        return;
      }
      
      // Success - redirect to main app (user is now logged in)
      goto('/');
    } catch (e) {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleReset();
  }
</script>

<svelte:head>
  <title>Reset Password - Filing System</title>
</svelte:head>

<div class="reset-container">
  <div class="reset-box">
    <div class="reset-header">
      <h1>Set New Password</h1>
      <p>Enter your new password below</p>
    </div>
    
    {#if !token}
      <div class="error-message">
        Invalid or missing reset token. Please request a new password reset link.
      </div>
      <a href="/forgot-password" class="back-link">Request new reset link</a>
    {:else}
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <div class="form-group">
        <label for="password">New Password</label>
        <input 
          type="password" 
          id="password" 
          bind:value={password} 
          on:keydown={handleKeydown}
          placeholder="At least 8 characters"
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input 
          type="password" 
          id="confirmPassword" 
          bind:value={confirmPassword} 
          on:keydown={handleKeydown}
          placeholder="Confirm your new password"
          disabled={loading}
        />
      </div>
      
      <button class="reset-btn" on:click={handleReset} disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    {/if}
  </div>
</div>

<style>
  .reset-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1b26;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .reset-box {
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 8px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .reset-header {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .reset-header h1 {
    color: #c0caf5;
    font-size: 24px;
    margin: 0 0 8px 0;
  }
  
  .reset-header p {
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
  
  .reset-btn {
    width: 100%;
    padding: 14px;
    background: #9ece6a;
    color: #1a1b26;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .reset-btn:hover:not(:disabled) {
    background: #a9d574;
  }
  
  .reset-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .back-link {
    display: block;
    text-align: center;
    margin-top: 20px;
    color: #7aa2f7;
    font-size: 13px;
    text-decoration: none;
  }
  
  .back-link:hover {
    text-decoration: underline;
  }
</style>
