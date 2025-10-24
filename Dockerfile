# Tahap 1: Build aplikasi React
FROM node:20-alpine AS builder

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin package.json dan package-lock.json (jika ada)
COPY package.json package-lock.json* ./

# Install semua dependensi (termasuk devDependencies untuk build)
RUN npm install

# Salin sisa kode sumber proyek
COPY . .

# Jalankan skrip build untuk membuat build produksi
RUN npm run build

# Tahap 2: Siapkan server Nginx untuk menyajikan file statis
FROM nginx:1.27-alpine AS runner

# Salin hasil build dari tahap 'builder' ke direktori default Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Salin file konfigurasi Nginx kustom
# Ini penting untuk menangani client-side routing (React Router)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Ekspos port 80
EXPOSE 4023

# Perintah default untuk menjalankan Nginx saat container dimulai
CMD ["nginx", "-g", "daemon off;"]
