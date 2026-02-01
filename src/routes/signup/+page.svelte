<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let name = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let error = '';
  let loading = false;
  
  // Check for invite token in URL
  $: inviteToken = $page.url.searchParams.get('token') || '';
  $: inviteEmail = $page.url.searchParams.get('email') || '';
  
  // Pre-fill email from invite
  $: if (inviteEmail && !email) {
    email = inviteEmail;
  }
  
  async function handleSignup() {
    error = '';
    
    if (!name || !email || !password) {
      error = 'Please fill in all fields';
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
    
    loading = true;
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          password,
          inviteToken: inviteToken || undefined
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error = data.error || 'Registration failed';
        return;
      }
      
      // Success - redirect to main app
      goto('/');
    } catch (e) {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSignup();
  }
</script>

<svelte:head>
  <title>Sign Up - Filing System</title>
</svelte:head>

<div class="signup-container">
  <div class="signup-box">
    <div class="signup-header">
      <h1>Create Account</h1>
      {#if inviteToken}
        <p class="invite-notice">You've been invited to join</p>
      {:else}
        <p>Sign up to get started</p>
      {/if}
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <div class="form-group">
      <label for="name">Full Name</label>
      <input 
        type="text" 
        id="name" 
        bind:value={name} 
        on:keydown={handleKeydown}
        placeholder="Enter your name"
        disabled={loading}
      />
    </div>
    
    <div class="form-group">
      <label for="email">Email</label>
      <input 
        type="email" 
        id="email" 
        bind:value={email} 
        on:keydown={handleKeydown}
        placeholder="Enter your email"
        disabled={loading || !!inviteEmail}
      />
    </div>
    
    <div class="form-group">
      <label for="password">Password</label>
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
        placeholder="Confirm your password"
        disabled={loading}
      />
    </div>
    
    <button class="signup-btn" on:click={handleSignup} disabled={loading}>
      {loading ? 'Creating Account...' : 'Create Account'}
    </button>
    
    <div class="login-link">
      Already have an account? <a href="/login">Sign in</a>
    </div>
  </div>
</div>

<style>
  .signup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1b26;
    font-family: 'JetBrains Mono', monospace;
  }
  
  .signup-box {
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 8px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .signup-header {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .signup-header h1 {
    color: #c0caf5;
    font-size: 24px;
    margin: 0 0 8px 0;
  }
  
  .signup-header p {
    color: #565f89;
    margin: 0;
    font-size: 14px;
  }
  
  .invite-notice {
    color: #9ece6a !important;
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
  
  .form-group input:disabled {
    opacity: 0.6;
  }
  
  .form-group input::placeholder {
    color: #565f89;
  }
  
  .signup-btn {
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
  
  .signup-btn:hover:not(:disabled) {
    background: #a9d574;
  }
  
  .signup-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .login-link {
    text-align: center;
    margin-top: 20px;
    color: #565f89;
    font-size: 13px;
  }
  
  .login-link a {
    color: #7aa2f7;
    text-decoration: none;
  }
  
  .login-link a:hover {
    text-decoration: underline;
  }
</style>
