# File Vault System - Setup Guide

## Prerequisites

Before setting up the File Vault System, ensure you have the following installed:

- **Go 1.21+** - [Download and install Go](https://golang.org/dl/)
- **Node.js 18+** - [Download and install Node.js](https://nodejs.org/)
- **PostgreSQL 15+** - [Download and install PostgreSQL](https://www.postgresql.org/download/)
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **Git** - [Install Git](https://git-scm.com/downloads)

## Quick Start with Docker

The fastest way to get the File Vault System running is using Docker Compose:

### 1. Clone the Repository
```bash
git clone <repository-url>
cd file-vault-system
```

### 2. Start All Services
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API server on port 8080
- Frontend React app on port 3000

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **GraphQL Playground**: http://localhost:8080/

### 4. Default Admin Account
- **Username**: admin
- **Password**: admin123
- **Email**: admin@filevault.local

⚠️ **Important**: Change the default admin password immediately in production!

## Manual Development Setup

### Backend Setup

1. **Navigate to Backend Directory**
   ```bash
   cd backend
   ```

2. **Install Dependencies**
   ```bash
   go mod tidy
   ```

3. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your database credentials and configuration.

4. **Set Up PostgreSQL Database**
   ```bash
   # Create database
   createdb filevault
   
   # Run migrations (automatic on first startup)
   ```

5. **Start the Backend Server**
   ```bash
   go run cmd/server/main.go
   ```

### Frontend Setup

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` file with your API endpoints.

4. **Start the Development Server**
   ```bash
   npm start
   ```

### Database Setup

1. **Create PostgreSQL Database**
   ```sql
   CREATE DATABASE filevault;
   CREATE USER filevault_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE filevault TO filevault_user;
   ```

2. **Run Migrations**
   Migrations run automatically when the backend starts. Manual execution:
   ```bash
   psql -d filevault -f backend/migrations/001_initial_schema.sql
   psql -d filevault -f backend/migrations/002_create_indexes.sql
   psql -d filevault -f backend/migrations/003_seed_data.sql
   ```

## Environment Variables

### Backend Environment Variables

Create `backend/.env` file with the following variables:

```env
# Server Configuration
ENVIRONMENT=development
PORT=8080

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=filevault
DB_SSL_MODE=disable

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24

# Storage Configuration
STORAGE_PATH=./uploads
MAX_FILE_SIZE=104857600
DEFAULT_USER_QUOTA=10485760

# Rate Limiting
RATE_LIMIT=2
RATE_LIMIT_WINDOW=1
RATE_LIMIT_BURST=5
```

### Frontend Environment Variables

Create `frontend/.env.local` file with:

```env
REACT_APP_API_URL=http://localhost:8080
REACT_APP_GRAPHQL_URL=http://localhost:8080/graphql
REACT_APP_MAX_FILE_SIZE=104857600
```

## Production Deployment

### Docker Production Setup

1. **Use Production Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

2. **Set Production Environment Variables**
   ```bash
   # Set strong JWT secret
   export JWT_SECRET="your-very-strong-production-secret"
   
   # Set production database credentials
   export DB_PASSWORD="strong-database-password"
   ```

3. **SSL/TLS Configuration**
   - Configure SSL certificates in `deployment/ssl/`
   - Update `deployment/nginx.conf` for your domain

### Manual Production Deployment

1. **Build Backend**
   ```bash
   cd backend
   CGO_ENABLED=0 GOOS=linux go build -o filevault-server cmd/server/main.go
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy to Server**
   - Copy backend binary and migrations to server
   - Serve frontend build files with Nginx
   - Set up PostgreSQL database
   - Configure reverse proxy and SSL

## Monitoring (Optional)

Enable monitoring with Prometheus and Grafana:

```bash
docker-compose --profile monitoring up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify database credentials in `.env`
   - Ensure database exists

2. **Port Already in Use**
   ```bash
   # Find process using port
   netstat -tulpn | grep :8080
   
   # Kill process
   kill -9 <process_id>
   ```

3. **Permission Denied on File Upload**
   ```bash
   # Fix upload directory permissions
   mkdir -p uploads
   chmod 755 uploads
   ```

4. **Frontend Can't Connect to Backend**
   - Check CORS configuration
   - Verify API URLs in frontend `.env.local`
   - Ensure backend is running

### Logs

**Backend Logs:**
```bash
docker-compose logs backend
```

**Frontend Logs:**
```bash
docker-compose logs frontend
```

**Database Logs:**
```bash
docker-compose logs database
```

## Development Tips

1. **Hot Reload**
   - Backend: Use `air` for Go hot reload
   - Frontend: Built-in with React dev server

2. **Database Reset**
   ```bash
   docker-compose down -v
   docker-compose up -d database
   ```

3. **Generate GraphQL Types**
   ```bash
   cd backend
   go run github.com/99designs/gqlgen generate
   ```

4. **Run Tests**
   ```bash
   # Backend tests
   cd backend && go test ./...
   
   # Frontend tests
   cd frontend && npm test
   ```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the logs for error messages
3. Ensure all prerequisites are properly installed
4. Verify environment variables are correctly set

## Security Notes

- Change default passwords before production use
- Use strong JWT secrets
- Enable SSL/TLS in production
- Regularly update dependencies
- Monitor logs for security events