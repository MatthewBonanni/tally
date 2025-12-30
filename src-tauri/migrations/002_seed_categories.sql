-- Seed default categories

-- Income categories
INSERT INTO categories (id, name, parent_id, category_type, icon, color, is_system, display_order) VALUES
('cat_income', 'Income', NULL, 'income', 'DollarSign', '#22c55e', 1, 0),
('cat_income_salary', 'Salary', 'cat_income', 'income', 'Briefcase', '#22c55e', 1, 1),
('cat_income_freelance', 'Freelance', 'cat_income', 'income', 'Laptop', '#22c55e', 1, 2),
('cat_income_investments', 'Investment Income', 'cat_income', 'income', 'TrendingUp', '#22c55e', 1, 3),
('cat_income_interest', 'Interest', 'cat_income', 'income', 'Percent', '#22c55e', 1, 4),
('cat_income_gifts', 'Gifts Received', 'cat_income', 'income', 'Gift', '#22c55e', 1, 5),
('cat_income_refunds', 'Refunds', 'cat_income', 'income', 'RotateCcw', '#22c55e', 1, 6),
('cat_income_other', 'Other Income', 'cat_income', 'income', 'CircleDollarSign', '#22c55e', 1, 7);

-- Expense categories
INSERT INTO categories (id, name, parent_id, category_type, icon, color, is_system, display_order) VALUES
-- Housing
('cat_housing', 'Housing', NULL, 'expense', 'Home', '#3b82f6', 1, 10),
('cat_housing_rent', 'Rent/Mortgage', 'cat_housing', 'expense', 'Home', '#3b82f6', 1, 11),
('cat_housing_utilities', 'Utilities', 'cat_housing', 'expense', 'Zap', '#3b82f6', 1, 12),
('cat_housing_insurance', 'Home Insurance', 'cat_housing', 'expense', 'Shield', '#3b82f6', 1, 13),
('cat_housing_maintenance', 'Maintenance', 'cat_housing', 'expense', 'Wrench', '#3b82f6', 1, 14),
('cat_housing_property_tax', 'Property Tax', 'cat_housing', 'expense', 'FileText', '#3b82f6', 1, 15),

-- Transportation
('cat_transport', 'Transportation', NULL, 'expense', 'Car', '#f59e0b', 1, 20),
('cat_transport_gas', 'Gas & Fuel', 'cat_transport', 'expense', 'Fuel', '#f59e0b', 1, 21),
('cat_transport_parking', 'Parking', 'cat_transport', 'expense', 'ParkingCircle', '#f59e0b', 1, 22),
('cat_transport_maintenance', 'Car Maintenance', 'cat_transport', 'expense', 'Wrench', '#f59e0b', 1, 23),
('cat_transport_insurance', 'Car Insurance', 'cat_transport', 'expense', 'Shield', '#f59e0b', 1, 24),
('cat_transport_public', 'Public Transit', 'cat_transport', 'expense', 'Bus', '#f59e0b', 1, 25),
('cat_transport_rideshare', 'Rideshare', 'cat_transport', 'expense', 'Car', '#f59e0b', 1, 26),

-- Food & Dining
('cat_food', 'Food & Dining', NULL, 'expense', 'Utensils', '#ef4444', 1, 30),
('cat_food_groceries', 'Groceries', 'cat_food', 'expense', 'ShoppingCart', '#ef4444', 1, 31),
('cat_food_restaurants', 'Restaurants', 'cat_food', 'expense', 'Utensils', '#ef4444', 1, 32),
('cat_food_coffee', 'Coffee Shops', 'cat_food', 'expense', 'Coffee', '#ef4444', 1, 33),
('cat_food_delivery', 'Food Delivery', 'cat_food', 'expense', 'Truck', '#ef4444', 1, 34),
('cat_food_bars', 'Bars & Alcohol', 'cat_food', 'expense', 'Wine', '#ef4444', 1, 35),

-- Shopping
('cat_shopping', 'Shopping', NULL, 'expense', 'ShoppingBag', '#8b5cf6', 1, 40),
('cat_shopping_clothing', 'Clothing', 'cat_shopping', 'expense', 'Shirt', '#8b5cf6', 1, 41),
('cat_shopping_electronics', 'Electronics', 'cat_shopping', 'expense', 'Smartphone', '#8b5cf6', 1, 42),
('cat_shopping_household', 'Household', 'cat_shopping', 'expense', 'Sofa', '#8b5cf6', 1, 43),
('cat_shopping_personal', 'Personal Care', 'cat_shopping', 'expense', 'Heart', '#8b5cf6', 1, 44),
('cat_shopping_gifts', 'Gifts Given', 'cat_shopping', 'expense', 'Gift', '#8b5cf6', 1, 45),

-- Entertainment
('cat_entertainment', 'Entertainment', NULL, 'expense', 'Film', '#ec4899', 1, 50),
('cat_entertainment_streaming', 'Streaming Services', 'cat_entertainment', 'expense', 'Tv', '#ec4899', 1, 51),
('cat_entertainment_movies', 'Movies & Shows', 'cat_entertainment', 'expense', 'Film', '#ec4899', 1, 52),
('cat_entertainment_games', 'Games', 'cat_entertainment', 'expense', 'Gamepad2', '#ec4899', 1, 53),
('cat_entertainment_books', 'Books & Magazines', 'cat_entertainment', 'expense', 'Book', '#ec4899', 1, 54),
('cat_entertainment_music', 'Music', 'cat_entertainment', 'expense', 'Music', '#ec4899', 1, 55),

-- Health
('cat_health', 'Health', NULL, 'expense', 'Heart', '#10b981', 1, 60),
('cat_health_insurance', 'Health Insurance', 'cat_health', 'expense', 'Shield', '#10b981', 1, 61),
('cat_health_doctor', 'Doctor', 'cat_health', 'expense', 'Stethoscope', '#10b981', 1, 62),
('cat_health_pharmacy', 'Pharmacy', 'cat_health', 'expense', 'Pill', '#10b981', 1, 63),
('cat_health_gym', 'Gym & Fitness', 'cat_health', 'expense', 'Dumbbell', '#10b981', 1, 64),
('cat_health_dental', 'Dental', 'cat_health', 'expense', 'Smile', '#10b981', 1, 65),
('cat_health_vision', 'Vision', 'cat_health', 'expense', 'Eye', '#10b981', 1, 66),

-- Bills & Subscriptions
('cat_bills', 'Bills & Subscriptions', NULL, 'expense', 'Receipt', '#64748b', 1, 70),
('cat_bills_phone', 'Phone', 'cat_bills', 'expense', 'Phone', '#64748b', 1, 71),
('cat_bills_internet', 'Internet', 'cat_bills', 'expense', 'Wifi', '#64748b', 1, 72),
('cat_bills_subscriptions', 'Subscriptions', 'cat_bills', 'expense', 'CreditCard', '#64748b', 1, 73),
('cat_bills_software', 'Software', 'cat_bills', 'expense', 'Code', '#64748b', 1, 74),

-- Personal
('cat_personal', 'Personal', NULL, 'expense', 'User', '#f97316', 1, 80),
('cat_personal_education', 'Education', 'cat_personal', 'expense', 'GraduationCap', '#f97316', 1, 81),
('cat_personal_pets', 'Pets', 'cat_personal', 'expense', 'Dog', '#f97316', 1, 82),
('cat_personal_childcare', 'Childcare', 'cat_personal', 'expense', 'Baby', '#f97316', 1, 83),
('cat_personal_charity', 'Charity & Donations', 'cat_personal', 'expense', 'HeartHandshake', '#f97316', 1, 84),

-- Travel
('cat_travel', 'Travel', NULL, 'expense', 'Plane', '#06b6d4', 1, 90),
('cat_travel_flights', 'Flights', 'cat_travel', 'expense', 'Plane', '#06b6d4', 1, 91),
('cat_travel_hotels', 'Hotels', 'cat_travel', 'expense', 'Hotel', '#06b6d4', 1, 92),
('cat_travel_rental', 'Car Rental', 'cat_travel', 'expense', 'Car', '#06b6d4', 1, 93),
('cat_travel_activities', 'Activities', 'cat_travel', 'expense', 'Map', '#06b6d4', 1, 94),

-- Financial
('cat_financial', 'Financial', NULL, 'expense', 'Landmark', '#6366f1', 1, 100),
('cat_financial_fees', 'Bank Fees', 'cat_financial', 'expense', 'CreditCard', '#6366f1', 1, 101),
('cat_financial_interest', 'Interest Paid', 'cat_financial', 'expense', 'Percent', '#6366f1', 1, 102),
('cat_financial_taxes', 'Taxes', 'cat_financial', 'expense', 'FileText', '#6366f1', 1, 103),
('cat_financial_loans', 'Loan Payments', 'cat_financial', 'expense', 'Landmark', '#6366f1', 1, 104),

-- Other
('cat_other', 'Other', NULL, 'expense', 'MoreHorizontal', '#94a3b8', 1, 200),
('cat_uncategorized', 'Uncategorized', NULL, 'expense', 'HelpCircle', '#94a3b8', 1, 201);

-- Transfer category
INSERT INTO categories (id, name, parent_id, category_type, icon, color, is_system, display_order) VALUES
('cat_transfer', 'Transfer', NULL, 'transfer', 'ArrowLeftRight', '#8b5cf6', 1, 300);
