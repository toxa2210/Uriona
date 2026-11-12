DO $$
BEGIN
  UPDATE "User"
  SET "role" = 'ADMIN'::"UserRole",
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "email" = 'artikovtohir2210@gmail.com';
END $$;
