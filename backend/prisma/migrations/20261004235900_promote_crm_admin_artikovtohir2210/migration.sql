DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "User"
    WHERE "email" = 'artikovtohir2210@gmail.com'
  ) THEN
    RAISE EXCEPTION 'CRM administrator account does not exist';
  END IF;

  UPDATE "User"
  SET "role" = 'ADMIN'::"UserRole",
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "email" = 'artikovtohir2210@gmail.com';
END $$;
