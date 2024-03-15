CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255),
    file_type VARCHAR(255),
    mime_type VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    verification_code TEXT,
    signup_type TEXT,
    role TEXT DEFAULT 'user',
    profile_picture INT REFERENCES uploads(id) ON DELETE CASCADE,
    referral_link TEXT UNIQUE,
    referral_id INT REFERENCES users(id),
    has_made_purchase BOOLEAN DEFAULT FALSE,
    otp TEXT,
    verify_email BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT NULL,
    payment TEXT DEFAULT FALSE,
    slug TEXT,
    is_bank_details BOOLEAN DEFAULT FALSE,
    block_status BOOLEAN DEFAULT FALSE,
    google_access_token TEXT DEFAULT NULL,
    google_refresh_token TEXT DEFAULT NULL,
    google_expiry_at timestamp with time zone,
    facebook_access_token TEXT DEFAULT NULL,
    apple_access_token TEXT DEFAULT NULL,
    zoom_access_token TEXT DEFAULT NULL,
    zoom_refresh_token TEXT DEFAULT NULL,
    zoom_expiry_at timestamp with time zone,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS availability_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_name TEXT,
    unique_id TEXT,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability (
    id SERIAL PRIMARY KEY,
    profile_id INT NOT NULL REFERENCES availability_profiles(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    CONSTRAINT valid_weekday CHECK (
        day_of_week IN (
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        )
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    availability_id INT NOT NULL REFERENCES availability(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS attach_services(
    id SERIAL PRIMARY KEY,
    service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_type(
    id SERIAL PRIMARY KEY,
    service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS attach_service_type(
    id SERIAL PRIMARY KEY,
    service_type_id INT NOT NULL REFERENCES service_type(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS events(
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    event_price INT,
    deposit_price INT,
    description TEXT,
    duration INT,
    duration_interval INTERVAL,
    one_to_one BOOLEAN NOT NULL DEFAULT FALSE,
    invite_in_type TEXT,
    -- custom date range | into future | availableDays
    date_range JSONB,
    into_future BOOLEAN DEFAULT FALSE,
    availableDays JSONB,
    -- { number of days: 60, preference: 'Working days' | 'Calendar days'}
    book_leading_time INT,
    -- the leading time in which user can schedule a event | like if 2 hours selected then user must schedule event before 2 hours
    invite_in INT,
    before_time INT,
    after_time INT,
    selected_avail_id INT REFERENCES availability_profiles(id) ON DELETE CASCADE,
    slug TEXT UNIQUE,
    user_slug TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS locations(
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    address TEXT,
    post_code TEXT,
    address_note TEXT,
    location JSONB,
    type TEXT,
    platform_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    text TEXT,
    options TEXT [],
    type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    status BOOLEAN DEFAULT FALSE,
    others BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduling_time TIMESTAMP WITH TIME ZONE NOT NULL,
    cancellation_reason TEXT,
    rescheduled_reason TEXT,
    google_calendar_event_id TEXT,
    google_meeting_link TEXT,
    zoom_meeting_id TEXT,
    zoom_meeting_link TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    -- can be pending, scheduled, rescheduled, cancelled
    -- add column to keep track of payment whether deposit or full paid?
    payment_status BOOLEAN DEFAULT FALSE,
    is_deposit_paid BOOLEAN DEFAULT FALSE,
    -- deposit || complete
    payment_info jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS question_responses (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT,
    options TEXT [],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invitee(
    id SERIAL PRIMARY KEY,
    email TEXT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invitee_scheduled(
    id SERIAL PRIMARY KEY,
    invitee_id INT NOT NULL REFERENCES invitee(id) ON DELETE CASCADE,
    schedule_id INT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS feedbacks(
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT,
    rating DECIMAL(10, 1),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS faqs(
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subscription_payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    tran_ref VARCHAR(255),
    merchant_id INT,
    profile_id INT,
    cart_id UUID,
    cart_description TEXT,
    cart_currency CHAR(3),
    cart_amount DECIMAL(10, 2),
    tran_currency CHAR(3),
    tran_total DECIMAL(10, 2),
    tran_type VARCHAR(50),
    tran_class VARCHAR(50),
    token VARCHAR(255),
    customer_details JSONB,
    payment_result JSONB,
    payment_info JSONB,
    ipn_trace VARCHAR(255),
    next_billing_date DATE NOT NULL,
    subscription_status VARCHAR(255) DEFAULT 'inactive',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS event_payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    tran_ref VARCHAR(255),
    merchant_id INT,
    profile_id INT,
    cart_id UUID,
    cart_description TEXT,
    cart_currency CHAR(3),
    cart_amount DECIMAL(10, 2),
    tran_currency CHAR(3),
    tran_total DECIMAL(10, 2),
    tran_type VARCHAR(50),
    tran_class VARCHAR(50),
    token VARCHAR(255),
    customer_details JSONB,
    payment_result JSONB,
    payment_info JSONB,
    ipn_trace VARCHAR(255),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS queries(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'pending',
    -- pending, contacted, dismissed,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bank_details(
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(255),
    account_name VARCHAR(255),
    account_holder_number VARCHAR(255),
    account_number VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS temp_schedule_details(
    id SERIAL PRIMARY KEY,
    scheduling_id INT REFERENCES schedule(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selected_date TEXT,
    selected_time TEXT,
    scheduling_time TIMESTAMP WITH TIME ZONE,
    responses jsonb [],
    type TEXT,
    platform_name TEXT,
    address TEXT,
    total_price TEXT,
    deposit_price TEXT,
    status TEXT DEFAULT 'pending',
    paid_to_user TEXT DEFAULT 'pending',
    is_deposit_paid BOOLEAN DEFAULT FALSE,
    tran_remaining_amount DECIMAL(10, 2),
    -- deposit || complete
    tran_ref VARCHAR(255),
    merchant_id INT,
    profile_id INT,
    cart_id UUID,
    cart_description TEXT,
    cart_currency CHAR(3),
    cart_amount DECIMAL(10, 2),
    tran_currency CHAR(3),
    tran_total DECIMAL(10, 2),
    tran_type VARCHAR(50),
    tran_class VARCHAR(50),
    token VARCHAR(255),
    customer_details JSONB,
    payment_result JSONB,
    payment_info JSONB,
    ipn_trace VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS features(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscription_plan(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS selected_features(
    id SERIAL PRIMARY KEY,
    subscription_plan_id INT NOT NULL REFERENCES subscription_plan(id) ON DELETE CASCADE,
    features_id INT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
