# VM Deployment Guide - MCP Server & Web

Complete guide for deploying your EntraID Manager to a virtual machine.

## 📋 Prerequisites

### On Your Local Machine (before deploying)
- Git installed
- SSH access to VM
- Azure credentials ready
- OpenAI API key ready

### On the VM
- Ubuntu 20.04 LTS or later (or equivalent)
- Root or sudo access
- Minimum 1GB RAM, 10GB disk space
- Internet access for npm packages

## 🚀 Step 1: Prepare the VM

### 1.1 Connect to VM
```bash
ssh username@your-vm-ip
# Or: ssh -i /path/to/key.pem username@your-vm-ip
```

### 1.2 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Node.js (v16 or later)
```bash
# Install Node.js 18 (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.4 Install Git (if not already installed)
```bash
sudo apt install -y git
```

### 1.5 Install PM2 (for persistent process management)
```bash
sudo npm install -g pm2

# Allow PM2 to start on boot
pm2 startup
# Copy and run the output command
```

### 1.6 (Optional) Install Nginx (for reverse proxy)
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 📂 Step 2: Clone and Setup Project

### 2.1 Clone Repository
```bash
cd /home/username
# Or use your preferred directory

git clone <your-repo-url>
cd demo1_mcp_server
```

Or copy via SCP if not using Git:
```bash
# From your local machine
scp -r ./mcp-server username@your-vm-ip:/home/username/demo1_mcp_server/
scp -r ./web username@your-vm-ip:/home/username/demo1_mcp_server/
scp package.json username@your-vm-ip:/home/username/demo1_mcp_server/
```

### 2.2 Create Environment Files

**For MCP Server** (`mcp-server/.env`):
```bash
cat > mcp-server/.env << 'EOF'
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
MCP_PORT=3001
EOF
```

**For Web Server** (`web/.env`):
```bash
cat > web/.env << 'EOF'
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:3001
WEB_PORT=3000
EOF
```

### 2.3 Install Dependencies
```bash
npm run install-all
# Or manually:
cd mcp-server && npm install && cd ..
cd web && npm install && cd ..
```

## 🔧 Step 3: Run Services with PM2

### 3.1 Start MCP Server
```bash
pm2 start mcp-server/src/index.js --name "mcp-server" --env mcp-server/.env

# Alternative: with direct environment variables
cd mcp-server
pm2 start src/index.js --name "mcp-server"
cd ..
```

### 3.2 Start Web Server
```bash
pm2 start web/server.js --name "web-server" --env web/.env
```

### 3.3 Save PM2 Configuration (for auto-restart on reboot)
```bash
pm2 save
pm2 startup
# Run the command output from pm2 startup
```

### 3.4 Verify Services are Running
```bash
pm2 list
pm2 logs

# Or check specific services
pm2 logs mcp-server
pm2 logs web-server
```

## 🌐 Step 4: Network & Security Setup

### 4.1 Open Firewall Ports
```bash
# For UFW (Ubuntu Firewall)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Web UI
sudo ufw allow 3001/tcp  # MCP Server (internal only - optional)
sudo ufw enable
```

Or use your cloud provider's security group:
- **AWS**: Edit security group inbound rules
- **Azure**: Edit Network Security Group
- **GCP**: Edit Firewall rules

Add these rules:
| Protocol | Port | Source | Purpose |
|----------|------|--------|---------|
| TCP | 22 | Your IP | SSH (limit source!) |
| TCP | 3000 | 0.0.0.0/0 | Web UI |
| TCP | 3001 | Localhost | MCP Server (internal) |

### 4.2 (Optional) Nginx Reverse Proxy with HTTPS

Create SSL certificate (using Let's Encrypt):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
```

Configure Nginx:
```bash
sudo tee /etc/nginx/sites-available/entraid-manager > /dev/null << 'EOF'
upstream mcp_server {
    server 127.0.0.1:3001;
}

upstream web_server {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Web Server
    location / {
        proxy_pass http://web_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # MCP Server (internal only - remove if needed)
    location /mcp/ {
        proxy_pass http://mcp_server/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/entraid-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 Step 5: Monitor & Maintain

### 5.1 Check Service Status
```bash
pm2 list
pm2 status
pm2 info mcp-server
pm2 info web-server
```

### 5.2 View Logs
```bash
# All logs
pm2 logs

# Specific service
pm2 logs mcp-server
pm2 logs web-server

# Real-time logs
pm2 logs mcp-server --lines 50 --follow
```

### 5.3 Restart Services
```bash
# Restart specific service
pm2 restart mcp-server
pm2 restart web-server

# Restart all
pm2 restart all
```

### 5.4 Stop Services
```bash
pm2 stop mcp-server
pm2 stop web-server

# Delete from PM2
pm2 delete mcp-server
pm2 delete web-server
```

### 5.5 Update Services
```bash
# Pull latest code
git pull origin main

# Reinstall dependencies if changed
npm run install-all

# Restart services
pm2 restart all
```

## 🧪 Step 6: Testing Deployment

### 6.1 Test from VM (local)
```bash
# Test MCP Server
curl http://localhost:3001/health
curl http://localhost:3001/tools

# Test Web Server
curl http://localhost:3000/api/health
```

### 6.2 Test from Local Machine
```bash
# Replace your-vm-ip with actual VM IP
curl http://your-vm-ip:3000/api/health
curl http://your-vm-ip:3001/health
```

### 6.3 Access Web UI
Open browser and go to:
```
http://your-vm-ip:3000
# Or if using domain:
https://your-domain.com
```

## 🔒 Security Best Practices

### 6.1 Protect Credentials
```bash
# Restrict .env file permissions
chmod 600 mcp-server/.env
chmod 600 web/.env

# Don't commit .env files
echo ".env" >> .gitignore
```

### 6.2 Firewall Rules
- Only allow SSH from your IP
- Restrict MCP Server to internal connections only
- Use HTTPS in production (via Nginx/reverse proxy)
- Implement rate limiting if exposed to public

### 6.3 Regular Updates
```bash
# Update Node.js packages
cd mcp-server && npm update && cd ..
cd web && npm update && cd ..

# Update system
sudo apt update && sudo apt upgrade -y
```

### 6.4 Monitor Resource Usage
```bash
# Check resource usage of PM2 processes
pm2 monit

# Or use system monitoring
top
htop  # (install if needed: sudo apt install htop)
```

## 🚨 Troubleshooting

### Services Won't Start

**Check PM2 logs:**
```bash
pm2 logs mcp-server --lines 100
pm2 logs web-server --lines 100
```

**Check Node.js is installed:**
```bash
node --version
npm --version
```

**Check dependencies:**
```bash
cd mcp-server && npm list && cd ..
cd web && npm list && cd ..
```

### Port Already in Use

```bash
# Find process using port 3001
sudo lsof -i :3001
sudo netstat -tlnp | grep 3001

# Kill the process
sudo kill -9 <PID>
```

### Azure Authentication Fails

```bash
# Verify .env variables
cat mcp-server/.env

# Test with curl
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{"name":"get_user_status","arguments":{"userId":"test@yourdomain.com"}}'
```

### OpenAI API Key Invalid

```bash
# Check web/.env
cat web/.env

# Verify key starts with sk-
```

### Can't Connect from Local Machine

```bash
# Check if port is open
telnet your-vm-ip 3000
# Should connect

# If not, check firewall
sudo ufw status
sudo iptables -L -n
```

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Azure credentials are valid and have correct permissions
- [ ] OpenAI API key is valid and has balance
- [ ] VM has Node.js v16+ installed
- [ ] PM2 is installed globally
- [ ] Repository is cloned/files copied to VM
- [ ] .env files are created with correct values
- [ ] Dependencies installed: `npm run install-all`
- [ ] Services start without errors: `pm2 start ...`
- [ ] Local testing works: `curl http://localhost:3001/health`
- [ ] Network allows traffic on ports 3000, 3001, 22

## 📈 Performance Tuning

### Increase PM2 Memory Limit
```bash
pm2 start mcp-server/src/index.js --name "mcp-server" --max-memory-restart 500M
pm2 start web/server.js --name "web-server" --max-memory-restart 500M
pm2 save
```

### Enable PM2 Clustering (for multi-core)
```bash
pm2 start mcp-server/src/index.js --name "mcp-server" -i max
pm2 start web/server.js --name "web-server" -i max
```

### Nginx Caching
Add to Nginx location block:
```nginx
proxy_cache_valid 200 10m;
proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504;
```

## 🔄 Backup & Recovery

### Backup Important Files
```bash
# Backup .env files (keep secure!)
tar czf backup.tar.gz mcp-server/.env web/.env

# Store securely (e.g., S3, encrypted storage)
```

### Automated Backups (optional)
```bash
# Create backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
tar czf ~/backups/entraid-$DATE.tar.gz ~/demo1_mcp_server/
EOF

chmod +x ~/backup.sh

# Schedule with cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup.sh") | crontab -
```

## 📞 Support & Logs

### Save Logs for Debugging
```bash
pm2 logs mcp-server > mcp-server.log 2>&1
pm2 logs web-server > web-server.log 2>&1

# Check logs
tail -f mcp-server.log
tail -f web-server.log
```

### System Info for Troubleshooting
```bash
echo "=== System Info ===" && uname -a
echo "=== Node.js ===" && node --version && npm --version
echo "=== PM2 ===" && pm2 -v
echo "=== Services ===" && pm2 list
echo "=== Network ===" && sudo ss -tlnp
```

## 🎯 Quick Reference Commands

```bash
# Deploy
git clone <repo>
cd demo1_mcp_server
npm run install-all

# Start services
pm2 start mcp-server/src/index.js --name "mcp-server" --env mcp-server/.env
pm2 start web/server.js --name "web-server" --env web/.env
pm2 save
pm2 startup

# Monitor
pm2 list
pm2 logs

# Test
curl http://localhost:3001/health
curl http://localhost:3000/api/health

# Update
git pull
npm run install-all
pm2 restart all
```

---

Your deployment is ready! For questions, check the logs or test endpoints with curl.
