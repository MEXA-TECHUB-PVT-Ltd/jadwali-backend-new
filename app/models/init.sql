CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    verification_code TEXT,
    signup_type TEXT,
    role TEXT DEFAULT 'user',
    referral_link TEXT UNIQUE,
    referral_id INT REFERENCES users(id),
    has_made_purchase BOOLEAN DEFAULT FALSE,
    otp TEXT,
    verify_email BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT NULL,
    payment TEXT DEFAULT FALSE,
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
    description VARCHAR(255),
    duration INT,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS locations(
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    address TEXT,
    post_code TEXT,
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
    google_calendar_event_id TEXT,
    zoom_meeting_id TEXT,
    zoom_meeting_link TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    -- can be pending, confirmed, cancelled
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
CREATE TABLE IF NOT EXISTS feedbacks(
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT,
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
