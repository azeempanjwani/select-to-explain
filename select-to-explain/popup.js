// Popup functionality for user registration and status

document.addEventListener('DOMContentLoaded', function() {
  const authForm = document.getElementById('authForm');
  const userInfo = document.getElementById('userInfo');
  const registrationForm = document.getElementById('registrationForm');
  const emailInput = document.getElementById('email');
  const registerBtn = document.getElementById('registerBtn');
  const emailError = document.getElementById('emailError');
  const successMessage = document.getElementById('successMessage');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');
  const usageCount = document.getElementById('usageCount');
  const progressFill = document.getElementById('progressFill');

  // Check authentication status when popup opens
  checkAuthStatus();

  // Handle registration form submission
  registrationForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    // Basic email validation
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }
    
    registerUser(email);
  });

  // Handle logout
  logoutBtn.addEventListener('click', function() {
    logout();
  });

  function checkAuthStatus() {
    chrome.runtime.sendMessage({cmd: 'checkAuth'}, function(response) {
      if (response && response.authenticated) {
        showUserInfo(response);
      } else {
        showAuthForm();
      }
    });
  }

  function registerUser(email) {
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';
    clearMessages();

    chrome.runtime.sendMessage({
      cmd: 'registerUser',
      email: email
    }, function(response) {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Start Using Explainer';

      if (response && response.success) {
        showSuccess('Account created! You can now use Explainer.');
        setTimeout(() => {
          checkAuthStatus(); // Refresh to show user info
        }, 1000);
      } else {
        showError(response.error || 'Registration failed. Please try again.');
      }
    });
  }

  function logout() {
    chrome.storage.local.clear(function() {
      showAuthForm();
    });
  }

  function showUserInfo(data) {
    authForm.classList.remove('active');
    userInfo.classList.add('active');
    
    userEmail.textContent = data.email;
    usageCount.textContent = `${data.dailyUsage} / ${data.dailyLimit}`;
    
    const percentage = (data.dailyUsage / data.dailyLimit) * 100;
    progressFill.style.width = `${percentage}%`;
    
    // Change progress bar color if near limit
    if (percentage >= 90) {
      progressFill.style.background = '#dc2626'; // Red
    } else if (percentage >= 70) {
      progressFill.style.background = '#f59e0b'; // Orange
    } else {
      progressFill.style.background = '#10b981'; // Green
    }
  }

  function showAuthForm() {
    userInfo.classList.remove('active');
    authForm.classList.add('active');
    clearMessages();
  }

  function showError(message) {
    emailError.textContent = message;
    successMessage.textContent = '';
  }

  function showSuccess(message) {
    successMessage.textContent = message;
    emailError.textContent = '';
  }

  function clearMessages() {
    emailError.textContent = '';
    successMessage.textContent = '';
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
});