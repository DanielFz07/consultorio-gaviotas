-- Seed básico: catálogo inicial de servicios y productos médicos
SET search_path TO consultorio;

INSERT INTO servicio (codigo, nombre, descripcion, precio, duracion_minutos) VALUES
  ('CONS-GEN', 'Consulta General', 'Evaluación clínica estándar', 25.00, 30),
  ('CONS-ESP', 'Consulta Especializada', 'Evaluación por especialista', 50.00, 45),
  ('CONTROL', 'Control Post-tratamiento', 'Revisión post-tratamiento', 15.00, 15),
  ('EXAM-LAB', 'Examen de Laboratorio', 'Toma y análisis de muestras', 35.00, 20),
  ('PROC-MEN', 'Procedimiento Menor', 'Procedimiento ambulatorio', 80.00, 60)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO producto (sku, nombre, descripcion, unidad, precio_venta, stock_actual, stock_minimo) VALUES
  ('MED-ABX-250', 'Antibiótico 250mg', 'Antibiótico de amplio espectro', 'tableta', 1.50, 200, 50),
  ('MED-ANF-100', 'Antiinflamatorio 100mg', 'Antiinflamatorio no esteroideo', 'tableta', 0.80, 150, 30),
  ('MED-ANP-30', 'Antiparasitario 30ml', 'Solución oral antiparasitaria', 'frasco', 8.00, 40, 10),
  ('MED-ANL-500', 'Analgésico 500mg', 'Analgésico de uso común', 'tableta', 0.60, 300, 50),
  ('MAT-CUR-10', 'Curitas 10u', 'Apósitos adhesivos', 'caja', 3.50, 100, 20),
  ('MAT-GAS-100', 'Gasa Estéril 100u', 'Gasa estéril para curaciones', 'paquete', 12.00, 80, 20)
ON CONFLICT (sku) DO NOTHING;

-- Pacientes de ejemplo
INSERT INTO paciente (cedula, nombre, apellido, fecha_nacimiento, telefono, email, sexo, antecedentes) VALUES
  ('12345678', 'María',   'González',  '1985-03-15', '0414-1234567', 'maria.gonzalez@email.com',  'FEMENINO',  'Hipertensión controlada'),
  ('23456789', 'José',    'Rodríguez', '1978-07-22', '0424-2345678', 'jose.rodriguez@email.com',  'MASCULINO', 'Diabetes tipo 2'),
  ('34567890', 'Ana',     'Martínez',  '1992-11-08', '0416-3456789', 'ana.martinez@email.com',    'FEMENINO',  'Sin antecedentes relevantes'),
  ('45678901', 'Luis',    'Hernández', '1965-01-30', '0426-4567890', 'luis.hernandez@email.com',  'MASCULINO', 'Cardiopatía isquémica'),
  ('56789012', 'Carmen',  'López',     '2001-09-12', '0412-5678901', 'carmen.lopez@email.com',    'FEMENINO',  'Alergia a la penicilina'),
  ('67890123', 'Pedro',   'Sánchez',   '1955-05-18', '0414-6789012', 'pedro.sanchez@email.com',   'MASCULINO', 'Asma bronquial')
ON CONFLICT (cedula) DO NOTHING;