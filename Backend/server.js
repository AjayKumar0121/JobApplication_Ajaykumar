const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// Serve static files (e.g., favicon.ico, logo.jpg)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.DB_NAME || 'job_applications',
    password: process.env.DB_PASSWORD || 'Password@12345',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function createApplicationsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS applications (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            mobile VARCHAR(20) NOT NULL,
            dob DATE NOT NULL,
            parent_name VARCHAR(255) NOT NULL,
            gender VARCHAR(50) NOT NULL,
            nationality VARCHAR(100) NOT NULL,
            marital_status VARCHAR(50),
            current_address TEXT NOT NULL,
            permanent_address TEXT NOT NULL,
            state VARCHAR(100) NOT NULL,
            city VARCHAR(100) NOT NULL,
            zipcode VARCHAR(20) NOT NULL,
            emergency_contact VARCHAR(255) NOT NULL,
            ssc_board VARCHAR(255) NOT NULL,
            ssc_year INTEGER NOT NULL,
            ssc_percentage VARCHAR(10) NOT NULL,
            intermediate_board VARCHAR(255),
            intermediate_year INTEGER,
            intermediate_percentage VARCHAR(10),
            college_name VARCHAR(255),
            qualification VARCHAR(255),
            branch VARCHAR(255),
            graduation_year INTEGER,
            graduation_percentage VARCHAR(10),
            additional_education JSONB,
            job_role VARCHAR(255) NOT NULL,
            preferred_location VARCHAR(255) NOT NULL,
            notice_period VARCHAR(100) NOT NULL,
            expected_salary NUMERIC,
            skills TEXT NOT NULL,
            experience_status VARCHAR(50) NOT NULL,
            years_experience INTEGER,
            company_name VARCHAR(255),
            designation VARCHAR(255),
            work_location VARCHAR(255),
            start_date VARCHAR(20),
            end_date VARCHAR(20),
            last_salary NUMERIC,
            alt_mobile VARCHAR(20),
            linkedin VARCHAR(255),
            github VARCHAR(255),
            certifications TEXT,
            reference_name VARCHAR(255),
            reference_email VARCHAR(255),
            resume_path VARCHAR(255) NOT NULL,
            cover_letter_path VARCHAR(255),
            submission_date TIMESTAMP NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending'
        );
    `;
    try {
        await pool.query(query);
        console.log('Applications table created or already exists');
    } catch (error) {
        console.error('Error creating applications table:', error.message, { query, position: error.position });
        throw error;
    }
}

async function syncApplicationsTable() {
    const expectedColumns = [
        { name: 'id', type: 'SERIAL PRIMARY KEY', defaultValue: null },
        { name: 'full_name', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'mobile', type: 'VARCHAR(20)', nullable: false, defaultValue: '' },
        { name: 'dob', type: 'DATE', nullable: false, defaultValue: '1970-01-01' },
        { name: 'parent_name', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'gender', type: 'VARCHAR(50)', nullable: false, defaultValue: '' },
        { name: 'nationality', type: 'VARCHAR(100)', nullable: false, defaultValue: '' },
        { name: 'marital_status', type: 'VARCHAR(50)', nullable: true, defaultValue: null },
        { name: 'current_address', type: 'TEXT', nullable: false, defaultValue: '' },
        { name: 'permanent_address', type: 'TEXT', nullable: false, defaultValue: '' },
        { name: 'state', type: 'VARCHAR(100)', nullable: false, defaultValue: '' },
        { name: 'city', type: 'VARCHAR(100)', nullable: false, defaultValue: '' },
        { name: 'zipcode', type: 'VARCHAR(20)', nullable: false, defaultValue: '' },
        { name: 'emergency_contact', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'ssc_board', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'ssc_year', type: 'INTEGER', nullable: false, defaultValue: 0 },
        { name: 'ssc_percentage', type: 'VARCHAR(10)', nullable: false, defaultValue: '' },
        { name: 'intermediate_board', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'intermediate_year', type: 'INTEGER', nullable: true, defaultValue: null },
        { name: 'intermediate_percentage', type: 'VARCHAR(10)', nullable: true, defaultValue: null },
        { name: 'college_name', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'qualification', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'branch', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'graduation_year', type: 'INTEGER', nullable: true, defaultValue: null },
        { name: 'graduation_percentage', type: 'VARCHAR(10)', nullable: true, defaultValue: null },
        { name: 'additional_education', type: 'JSONB', nullable: true, defaultValue: null },
        { name: 'job_role', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'preferred_location', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'notice_period', type: 'VARCHAR(100)', nullable: false, defaultValue: '' },
        { name: 'expected_salary', type: 'NUMERIC', nullable: true, defaultValue: null },
        { name: 'skills', type: 'TEXT', nullable: false, defaultValue: '' },
        { name: 'experience_status', type: 'VARCHAR(50)', nullable: false, defaultValue: '' },
        { name: 'years_experience', type: 'INTEGER', nullable: true, defaultValue: null },
        { name: 'company_name', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'designation', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'work_location', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'start_date', type: 'VARCHAR(20)', nullable: true, defaultValue: null },
        { name: 'end_date', type: 'VARCHAR(20)', nullable: true, defaultValue: null },
        { name: 'last_salary', type: 'NUMERIC', nullable: true, defaultValue: null },
        { name: 'alt_mobile', type: 'VARCHAR(20)', nullable: true, defaultValue: null },
        { name: 'linkedin', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'github', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'certifications', type: 'TEXT', nullable: true, defaultValue: null },
        { name: 'reference_name', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'reference_email', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'resume_path', type: 'VARCHAR(255)', nullable: false, defaultValue: '' },
        { name: 'cover_letter_path', type: 'VARCHAR(255)', nullable: true, defaultValue: null },
        { name: 'submission_date', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'status', type: 'VARCHAR(50)', nullable: true, defaultValue: 'Pending' }
    ];

    try {
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'applications';
        `);

        const existingColumns = result.rows.map(row => ({
            name: row.column_name,
            type: row.data_type.toUpperCase(),
            length: row.character_maximum_length,
            nullable: row.is_nullable === 'YES' ? '' : 'NOT NULL'
        }));

        const missingColumns = expectedColumns.filter(
            col => !existingColumns.some(ex => ex.name === col.name)
        );

        for (const col of missingColumns) {
            let columnType = col.type;
            if (col.type.includes('VARCHAR') || col.type.includes('TEXT') || col.type.includes('JSONB')) {
                await pool.query(`
                    ALTER TABLE applications
                    ADD COLUMN ${col.name} ${col.type.replace('NOT NULL', '').trim()} ${col.defaultValue ? `DEFAULT '${col.defaultValue}'` : ''};
                `);
                if (col.defaultValue !== null && col.type !== 'SERIAL PRIMARY KEY') {
                    await pool.query(`
                        UPDATE applications
                        SET ${col.name} = $1
                        WHERE ${col.name} IS NULL;
                    `, [col.defaultValue]);
                }
                if (col.nullable === false) {
                    await pool.query(`
                        ALTER TABLE applications
                        ALTER COLUMN ${col.name} SET NOT NULL;
                    `);
                }
                console.log(`Added column ${col.name} to applications table`);
            } else {
                await pool.query(`
                    ALTER TABLE applications
                    ADD COLUMN ${col.name} ${col.type.replace('NOT NULL', '').trim()} ${col.defaultValue ? `DEFAULT ${col.defaultValue}` : ''};
                `);
                if (col.defaultValue !== null && col.type !== 'SERIAL PRIMARY KEY') {
                    await pool.query(`
                        UPDATE applications
                        SET ${col.name} = $1
                        WHERE ${col.name} IS NULL;
                    `, [col.defaultValue]);
                }
                if (col.nullable === false) {
                    await pool.query(`
                        ALTER TABLE applications
                        ALTER COLUMN ${col.name} SET NOT NULL;
                    `);
                }
                console.log(`Added column ${col.name} to applications table`);
            }
        }
    } catch (error) {
        console.error('Error syncing applications table:', error.message);
    }
}

pool.connect()
    .then(async () => {
        console.log('Database connected successfully');
        await createApplicationsTable();
        await syncApplicationsTable();
    })
    .catch(err => console.error('Database connection error:', err.message));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(`Saving file ${file.originalname} to ${uploadDir}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
        console.log(`Generated filename: ${filename}`);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        console.log(`File ${file.originalname} is a valid PDF`);
        cb(null, true);
    } else {
        console.error(`File ${file.originalname} rejected: Only PDF files are allowed`);
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// Serve the HTML file
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Form submission endpoint
app.post('/api/submit', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cover_letter', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('Received form submission:', {
            body: req.body,
            files: req.files ? {
                resume: req.files['resume'] ? req.files['resume'][0] : null,
                cover_letter: req.files['cover_letter'] ? req.files['cover_letter'][0] : null
            } : null
        });

        const {
            full_name, email, mobile, dob, parent_name, gender, nationality, marital_status,
            current_address, permanent_address, state, city, zipcode, emergency_contact,
            ssc_board, ssc_year, ssc_percentage,
            intermediate_board, intermediate_year, intermediate_percentage,
            college_name, qualification, branch, graduation_year, graduation_percentage,
            additional_education, job_role, preferred_location, notice_period,
            expected_salary, skills, experience_status, years_experience, company_name,
            designation, work_location, start_date, end_date, last_salary,
            alt_mobile, linkedin, github, certifications, reference_name, reference_email
        } = req.body;

        console.log('Validating required fields...');
        const requiredFields = [
            'full_name', 'email', 'mobile', 'dob', 'parent_name', 'gender', 'nationality',
            'current_address', 'permanent_address', 'state', 'city', 'zipcode', 'emergency_contact',
            'ssc_board', 'ssc_year', 'ssc_percentage', 'job_role', 'preferred_location',
            'notice_period', 'skills', 'experience_status'
        ];
        const missingFields = requiredFields.filter(field => !req.body[field] && req.body[field] !== '');
        if (missingFields.length > 0) {
            console.error('Missing required fields:', missingFields);
            return res.status(400).json({ success: false, error: 'Missing required fields', missing: missingFields });
        }

        console.log('Sanitizing integer fields...');
        const sanitizeInteger = (value, fieldName, isNullable) => {
            if (value === '' || value === undefined || value === null) {
                if (isNullable) return null;
                throw new Error(`Invalid ${fieldName}: empty value not allowed for non-nullable field`);
            }
            const parsed = parseInt(value, 10);
            if (isNaN(parsed)) {
                throw new Error(`Invalid ${fieldName}: "${value}" is not a valid integer`);
            }
            return parsed;
        };

        const sanitizedSscYear = sanitizeInteger(ssc_year, 'ssc_year', false);
        const sanitizedIntermediateYear = sanitizeInteger(intermediate_year, 'intermediate_year', true);
        const sanitizedGraduationYear = sanitizeInteger(graduation_year, 'graduation_year', true);
        const sanitizedYearsExperience = sanitizeInteger(years_experience, 'years_experience', true);

        console.log('Validating optional sections...');
        const validateEducationSection = (fields) => {
            const hasValue = fields.some(field => req.body[field] && req.body[field] !== '');
            if (hasValue) {
                return fields.every(field => req.body[field] && req.body[field] !== '');
            }
            return true;
        };

        const intermediateValid = validateEducationSection(['intermediate_board', 'intermediate_year', 'intermediate_percentage']);
        const graduationValid = validateEducationSection(['college_name', 'qualification', 'branch', 'graduation_year', 'graduation_percentage']);
        const experienceValid = experience_status !== 'Experienced' || (
            years_experience && company_name && designation && work_location && start_date && end_date
        );

        if (!intermediateValid || !graduationValid || !experienceValid) {
            console.error('Incomplete optional section data:', { intermediateValid, graduationValid, experienceValid });
            return res.status(400).json({ success: false, error: 'Incomplete optional section data' });
        }

        console.log('Processing additional education...');
        let additionalEducation = [];
        if (additional_education) {
            try {
                additionalEducation = typeof additional_education === 'string' 
                    ? JSON.parse(additional_education) : additional_education;
                if (!Array.isArray(additionalEducation)) {
                    throw new Error('additional_ ation must be an array');
                }
            } catch (e) {
                console.error('Error parsing additional_education:', e.message);
                return res.status(400).json({ success: false, error: 'Invalid additional_education format' });
            }
        }

        for (let edu of additionalEducation) {
            if (!edu.institution || !edu.qualification || !edu.year || !edu.percentage) {
                console.error('Incomplete additional education data:', edu);
                return res.status(400).json({ success: false, error: 'Incomplete additional education data' });
            }
        }

        const resumePath = req.files['resume'] ? req.files['resume'][0].path : null;
        const coverLetterPath = req.files['cover_letter'] ? req.files['cover_letter'][0].path : null;

        console.log('File upload details:', { resumePath, coverLetterPath });

        if (!resumePath) {
            console.error('Resume is required but not provided');
            return res.status(400).json({ success: false, error: 'Resume is required' });
        }

        console.log('Inserting data into database...');
        const query = `
            INSERT INTO applications (
                full_name, email, mobile, dob, parent_name, gender, nationality, marital_status,
                current_address, permanent_address, state, city, zipcode, emergency_contact,
                ssc_board, ssc_year, ssc_percentage, intermediate_board, intermediate_year,
                intermediate_percentage, college_name, qualification, branch, graduation_year,
                graduation_percentage, additional_education, job_role, preferred_location,
                notice_period, expected_salary, skills, experience_status, years_experience,
                company_name, designation, work_location, start_date, end_date, last_salary,
                alt_mobile, linkedin, github, certifications, reference_name, reference_email,
                resume_path, cover_letter_path, submission_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
                $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49
            ) RETURNING id
        `;

        const values = [
            full_name, email, mobile, dob, parent_name, gender, nationality, marital_status,
            current_address, permanent_address, state, city, zipcode, emergency_contact,
            ssc_board, sanitizedSscYear, ssc_percentage, intermediate_board, sanitizedIntermediateYear,
            intermediate_percentage, college_name, qualification, branch, sanitizedGraduationYear,
            graduation_percentage, JSON.stringify(additionalEducation), job_role,
            preferred_location, notice_period, expected_salary ? parseFloat(expected_salary) : null,
            skills, experience_status, sanitizedYearsExperience, company_name, designation,
            work_location, start_date, end_date, last_salary ? parseFloat(last_salary) : null,
            alt_mobile, linkedin, github, certifications, reference_name, reference_email,
            resumePath, coverLetterPath, new Date(), 'Pending'
        ];

        const result = await pool.query(query, values);
        console.log('Database insertion successful, application ID:', result.rows[0].id);

        const response = { 
            success: true, 
            id: result.rows[0].id,
            message: 'Application submitted successfully'
        };
        console.log('Sending response to client:', response);
        res.json(response);
    } catch (error) {
        console.error('Error processing submission:', error.message, { stack: error.stack });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single application by ID
app.get('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Fetching application with ID: ${id}`);
        const query = 'SELECT * FROM applications WHERE id = $1';
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            console.error(`Application with ID ${id} not found`);
            return res.status(404).json({ 
                success: false, 
                error: 'Application not found' 
            });
        }

        const application = result.rows[0];
        if (application.additional_education) {
            try {
                if (typeof application.additional_education === 'string') {
                    application.additional_education = JSON.parse(application.additional_education);
                }
                if (!Array.isArray(application.additional_education)) {
                    application.additional_education = [];
                }
            } catch (e) {
                console.error('Error parsing additional_education:', e);
                application.additional_education = [];
            }
        } else {
            application.additional_education = [];
        }

        console.log(`Application fetched successfully: ID ${id}`);
        res.json({ 
            success: true, 
            application 
        });
    } catch (error) {
        console.error('Error fetching application:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get all applications
app.get('/api/applications', async (req, res) => {
    try {
        console.log('Fetching all applications...');
        const query = `
            SELECT id, full_name, email, job_role, submission_date,
                   resume_path, cover_letter_path, status
            FROM applications
            ORDER BY submission_date DESC
        `;
        const result = await pool.query(query);
        console.log(`Fetched ${result.rows.length} applications`);
        res.json({ success: true, applications: result.rows });
    } catch (error) {
        console.error('Error fetching applications:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update application status
app.put('/api/applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        console.log(`Updating status for application ID ${id} to: ${status}`);

        if (!['Pending', 'Approved', 'Rejected', 'Under Review'].includes(status)) {
            console.error(`Invalid status: ${status}`);
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const query = 'UPDATE applications SET status = $1 WHERE id = $2 RETURNING id';
        const result = await pool.query(query, [status, id]);

        if (result.rows.length === 0) {
            console.error(`Application with ID ${id} not found`);
            return res.status(404).json({ success: false, error: 'Application not found' });
        }

        console.log(`Status updated successfully for application ID ${id}`);
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error updating application status:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a single application by ID
app.delete('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Deleting application with ID: ${id}`);
        
        const getQuery = 'SELECT resume_path, cover_letter_path FROM applications WHERE id = $1';
        const getResult = await pool.query(getQuery, [id]);
        
        if (getResult.rows.length === 0) {
            console.error(`Application with ID ${id} not found`);
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        
        const { resume_path, cover_letter_path } = getResult.rows[0];
        
        const deleteQuery = 'DELETE FROM applications WHERE id = $1 RETURNING id';
        const deleteResult = await pool.query(deleteQuery, [id]);
        
        if (resume_path && fs.existsSync(resume_path)) {
            console.log(`Deleting resume file: ${resume_path}`);
            fs.unlinkSync(resume_path);
        }
        if (cover_letter_path && fs.existsSync(cover_letter_path)) {
            console.log(`Deleting cover letter file: ${cover_letter_path}`);
            fs.unlinkSync(cover_letter_path);
        }
        
        console.log(`Application ID ${id} deleted successfully`);
        res.json({ 
            success: true, 
            id: deleteResult.rows[0].id,
            message: 'Application deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting application:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Clear all applications
app.delete('/api/clear', async (req, res) => {
    try {
        console.log('Clearing all applications...');
        fs.readdir(uploadDir, (err, files) => {
            if (err) {
                console.error('Error reading upload directory:', err.message);
                return;
            }
            for (const file of files) {
                console.log(`Deleting file: ${file}`);
                fs.unlink(path.join(uploadDir, file), err => {
                    if (err) console.error('Error deleting file:', err.message);
                });
            }
        });

        const query = 'TRUNCATE TABLE applications RESTART IDENTITY';
        await pool.query(query);
        console.log('All applications cleared from database');
        res.json({ success: true, message: 'All applications cleared successfully' });
    } catch (error) {
        console.error('Error clearing applications:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download resume or cover letter
app.get('/api/download/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Downloading ${type} for application ID: ${id}`);
        if (!['resume', 'cover_letter'].includes(type)) {
            console.error(`Invalid file type: ${type}`);
            return res.status(400).json({ success: false, error: 'Invalid file type' });
        }

        const query = `SELECT ${type}_path FROM applications WHERE id = $1`;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0 || !result.rows[0][`${type}_path`]) {
            console.error(`File not found for ${type}, application ID: ${id}`);
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        const filePath = result.rows[0][`${type}_path`];
        console.log(`Sending file: ${filePath}`);
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err.message);
                res.status(500).json({ success: false, error: 'Error downloading file' });
            }
        });
    } catch (error) {
        console.error('Error processing download:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve uploaded files
app.use('/Uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message, { stack: err.stack });
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ success: false, error: 'File upload error: ' + err.message });
    }
    if (err.message === 'Not allowed by CORS') {
        console.error('CORS error:', err.message);
        return res.status(403).json({ success: false, error: 'CORS policy violation' });
    }
    res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
