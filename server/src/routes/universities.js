import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/universities — list all, with optional search ?q=lagos
router.get("/", async (req, res) => {
  try {
    const { q, type } = req.query;
    const where = {};
    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }
    if (type) {
      where.type = type;
    }
    const rows = await prisma.university.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { departments: true, userProfiles: true } },
      },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id — single university with departments
router.get("/:id", async (req, res) => {
  try {
    const row = await prisma.university.findUnique({
      where: { id: req.params.id },
      include: {
        departments: {
          orderBy: { name: "asc" },
          include: { _count: { select: { subjects: true } } },
        },
        _count: { select: { userProfiles: true } },
      },
    });
    if (!row) return res.status(404).json({ error: "University not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/:id/departments — departments for a university
router.get("/:id/departments", async (req, res) => {
  try {
    const depts = await prisma.department.findMany({
      where: { universityId: req.params.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { subjects: true } } },
    });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities — TEACHER/LECTURER/ADMIN only
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN"), async (req, res) => {
  try {
    const { name, type, country, city } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const uni = await prisma.university.create({
      data: {
        name,
        type: type || "university",
        country: country || "Nigeria",
        city: city || null,
      },
    });
    res.status(201).json(uni);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "University already exists" });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/departments — create department under university
router.post("/:id/departments", requireAuth, requireRole("TEACHER", "LECTURER", "ADMIN"), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const uni = await prisma.university.findUnique({ where: { id: req.params.id } });
    if (!uni) return res.status(404).json({ error: "University not found" });
    const dept = await prisma.department.create({
      data: { name, icon: icon || null, universityId: req.params.id },
    });
    res.status(201).json(dept);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Department already exists" });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/seed — seed initial Nigerian universities (admin only)
router.post("/seed", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  try {
    const seeds = [
      // ── Federal Universities ──
      { name: "Abubakar Tafawa Balewa University", type: "university", country: "Nigeria", city: "Bauchi" },
      { name: "Adeyemi Federal University of Education", type: "university", country: "Nigeria", city: "Ondo" },
      { name: "Admiralty University, Ibusa", type: "university", country: "Nigeria", city: "Ibusa" },
      { name: "Ahmadu Bello University", type: "university", country: "Nigeria", city: "Zaria" },
      { name: "Air Force Institute of Technology", type: "university", country: "Nigeria", city: "Kaduna" },
      { name: "Alex Ekwueme Federal University, Ndufu-Alike Ikwo", type: "university", country: "Nigeria", city: "Ikwo" },
      { name: "Alvan Ikoku Federal University of Education", type: "university", country: "Nigeria", city: "Owerri" },
      { name: "Bayero University, Kano", type: "university", country: "Nigeria", city: "Kano" },
      { name: "Federal University, Birnin Kebbi", type: "university", country: "Nigeria", city: "Birnin Kebbi" },
      { name: "Federal University, Dutse", type: "university", country: "Nigeria", city: "Dutse" },
      { name: "Federal University, Dutsin-Ma", type: "university", country: "Nigeria", city: "Dutsin-Ma" },
      { name: "Federal University, Gashua", type: "university", country: "Nigeria", city: "Gashua" },
      { name: "Federal University, Gusau", type: "university", country: "Nigeria", city: "Gusau" },
      { name: "Federal University, Kashere", type: "university", country: "Nigeria", city: "Kashere" },
      { name: "Federal University, Lokoja", type: "university", country: "Nigeria", city: "Lokoja" },
      { name: "Federal University of Lafia", type: "university", country: "Nigeria", city: "Lafia" },
      { name: "Federal University of Agriculture, Abeokuta", type: "university", country: "Nigeria", city: "Abeokuta" },
      { name: "Federal University of Agriculture, Mubi", type: "university", country: "Nigeria", city: "Mubi" },
      { name: "Federal University of Agriculture, Zuru", type: "university", country: "Nigeria", city: "Zuru" },
      { name: "Federal University of Applied Sciences, Kachia", type: "university", country: "Nigeria", city: "Kachia" },
      { name: "Federal University of Education, Pankshin", type: "university", country: "Nigeria", city: "Pankshin" },
      { name: "Federal University of Education, Zaria", type: "university", country: "Nigeria", city: "Zaria" },
      { name: "Federal University of Health Sciences, Azare", type: "university", country: "Nigeria", city: "Azare" },
      { name: "Federal University of Petroleum Resources, Effurun", type: "university", country: "Nigeria", city: "Effurun" },
      { name: "Federal University of Technology, Akure", type: "university", country: "Nigeria", city: "Akure" },
      { name: "Federal University of Technology, Minna", type: "university", country: "Nigeria", city: "Minna" },
      { name: "Federal University of Technology, Owerri", type: "university", country: "Nigeria", city: "Owerri" },
      { name: "Federal University of Transportation, Daura", type: "university", country: "Nigeria", city: "Daura" },
      { name: "Federal University, Otuoke", type: "university", country: "Nigeria", city: "Otuoke" },
      { name: "Federal University, Oye-Ekiti", type: "university", country: "Nigeria", city: "Oye-Ekiti" },
      { name: "Federal University, Wukari", type: "university", country: "Nigeria", city: "Wukari" },
      { name: "Joseph Sarwuan Tarka University, Makurdi", type: "university", country: "Nigeria", city: "Makurdi" },
      { name: "Michael Okpara University of Agriculture, Umudike", type: "university", country: "Nigeria", city: "Umudike" },
      { name: "Modibbo Adama University, Yola", type: "university", country: "Nigeria", city: "Yola" },
      { name: "National Open University of Nigeria", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Nigeria Police Academy, Wudil", type: "university", country: "Nigeria", city: "Wudil" },
      { name: "Nigerian Army University, Biu", type: "university", country: "Nigeria", city: "Biu" },
      { name: "Nigerian Defence Academy", type: "university", country: "Nigeria", city: "Kaduna" },
      { name: "Nigerian Maritime University", type: "university", country: "Nigeria", city: "Warri" },
      { name: "Nnamdi Azikiwe University", type: "university", country: "Nigeria", city: "Awka" },
      { name: "Obafemi Awolowo University", type: "university", country: "Nigeria", city: "Ile-Ife" },
      { name: "Tai Solarin Federal University of Education", type: "university", country: "Nigeria", city: "Ijebu-Ode" },
      { name: "University of Abuja", type: "university", country: "Nigeria", city: "Gwagwalada" },
      { name: "University of Benin", type: "university", country: "Nigeria", city: "Benin City" },
      { name: "University of Calabar", type: "university", country: "Nigeria", city: "Calabar" },
      { name: "University of Ibadan", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "University of Ilorin", type: "university", country: "Nigeria", city: "Ilorin" },
      { name: "University of Jos", type: "university", country: "Nigeria", city: "Jos" },
      { name: "University of Lagos", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "University of Maiduguri", type: "university", country: "Nigeria", city: "Maiduguri" },
      { name: "University of Nigeria, Nsukka", type: "university", country: "Nigeria", city: "Nsukka" },
      { name: "University of Port Harcourt", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "University of Uyo", type: "university", country: "Nigeria", city: "Uyo" },
      { name: "Usmanu Danfodiyo University", type: "university", country: "Nigeria", city: "Sokoto" },
      { name: "Yusuf Maitama Sule Federal University of Education, Kano", type: "university", country: "Nigeria", city: "Kano" },

      // ── State Universities ──
      { name: "Abdulkadir Kure University, Minna", type: "university", country: "Nigeria", city: "Minna" },
      { name: "Abia State University", type: "university", country: "Nigeria", city: "Uturu" },
      { name: "Abiola Ajimobi Technical University", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "Adamawa State University", type: "university", country: "Nigeria", city: "Mubi" },
      { name: "Adekunle Ajasin University", type: "university", country: "Nigeria", city: "Akungba-Akoko" },
      { name: "Akwa Ibom State University", type: "university", country: "Nigeria", city: "Uyo" },
      { name: "Aliko Dangote University of Science and Technology, Wudil", type: "university", country: "Nigeria", city: "Wudil" },
      { name: "Ambrose Alli University", type: "university", country: "Nigeria", city: "Ekpoma" },
      { name: "Bauchi State University", type: "university", country: "Nigeria", city: "Gadau" },
      { name: "Bayelsa Medical University", type: "university", country: "Nigeria", city: "Yenagoa" },
      { name: "Benue State University", type: "university", country: "Nigeria", city: "Makurdi" },
      { name: "Borno State University", type: "university", country: "Nigeria", city: "Maiduguri" },
      { name: "Chukwuemeka Odumegwu Ojukwu University", type: "university", country: "Nigeria", city: "Uli" },
      { name: "Delta State University, Abraka", type: "university", country: "Nigeria", city: "Abraka" },
      { name: "Delta State University of Science and Technology, Ozoro", type: "university", country: "Nigeria", city: "Ozoro" },
      { name: "Dennis Osadebay University", type: "university", country: "Nigeria", city: "Asaba" },
      { name: "Ebonyi State University", type: "university", country: "Nigeria", city: "Abakaliki" },
      { name: "Edo State University, Uzairue", type: "university", country: "Nigeria", city: "Iyamho" },
      { name: "Ekiti State University", type: "university", country: "Nigeria", city: "Ado-Ekiti" },
      { name: "Emmanuel Alayande University of Education", type: "university", country: "Nigeria", city: "Oyo" },
      { name: "Enugu State University of Science and Technology", type: "university", country: "Nigeria", city: "Enugu" },
      { name: "Gombe State University", type: "university", country: "Nigeria", city: "Gombe" },
      { name: "Gombe State University of Science and Technology, Kumo", type: "university", country: "Nigeria", city: "Kumo" },
      { name: "Ibrahim Badamasi Babangida University, Lapai", type: "university", country: "Nigeria", city: "Lapai" },
      { name: "Ignatius Ajuru University of Education", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Imo State University", type: "university", country: "Nigeria", city: "Owerri" },
      { name: "Kaduna State University", type: "university", country: "Nigeria", city: "Kaduna" },
      { name: "Kebbi State University of Science and Technology, Aliero", type: "university", country: "Nigeria", city: "Aliero" },
      { name: "Kingsley Ozumba Mbadiwe University", type: "university", country: "Nigeria", city: "Ideato South" },
      { name: "Kwara State University", type: "university", country: "Nigeria", city: "Malete" },
      { name: "Prince Abubakar Audu University", type: "university", country: "Nigeria", city: "Anyigba" },
      { name: "Ladoke Akintola University of Technology", type: "university", country: "Nigeria", city: "Ogbomoso" },
      { name: "Lagos State University", type: "university", country: "Nigeria", city: "Ojo" },
      { name: "Lagos State University of Education", type: "university", country: "Nigeria", city: "Ijanikin" },
      { name: "Lagos State University of Science and Technology", type: "university", country: "Nigeria", city: "Ikorodu" },
      { name: "Nasarawa State University, Keffi", type: "university", country: "Nigeria", city: "Keffi" },
      { name: "Niger Delta University", type: "university", country: "Nigeria", city: "Amassoma" },
      { name: "Olabisi Onabanjo University", type: "university", country: "Nigeria", city: "Ago-Iwoye" },
      { name: "Olusegun Agagu University of Science and Technology", type: "university", country: "Nigeria", city: "Okitipupa" },
      { name: "Osun State University", type: "university", country: "Nigeria", city: "Osogbo" },
      { name: "Plateau State University", type: "university", country: "Nigeria", city: "Bokkos" },
      { name: "Rivers State University", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Sule Lamido University", type: "university", country: "Nigeria", city: "Kafin-Hausa" },
      { name: "Taraba State University", type: "university", country: "Nigeria", city: "Jalingo" },
      { name: "Umaru Musa Yar'adua University", type: "university", country: "Nigeria", city: "Katsina" },
      { name: "University of Cross River State", type: "university", country: "Nigeria", city: "Calabar" },
      { name: "Sokoto State University", type: "university", country: "Nigeria", city: "Sokoto" },
      { name: "University of Delta, Agbor", type: "university", country: "Nigeria", city: "Agbor" },
      { name: "Yobe State University, Damaturu", type: "university", country: "Nigeria", city: "Damaturu" },
      { name: "Yusuf Maitama Sule University, Kano", type: "university", country: "Nigeria", city: "Kano" },
      { name: "Zamfara State University", type: "university", country: "Nigeria", city: "Talata Mafara" },

      // ── Private Universities ──
      { name: "Achievers University", type: "university", country: "Nigeria", city: "Owo" },
      { name: "Adeleke University", type: "university", country: "Nigeria", city: "Ede" },
      { name: "Afe Babalola University", type: "university", country: "Nigeria", city: "Ado-Ekiti" },
      { name: "African University of Science and Technology, Abuja", type: "university", country: "Nigeria", city: "Abuja" },
      { name: "Ahman Pategi University", type: "university", country: "Nigeria", city: "Pategi" },
      { name: "Ajayi Crowther University", type: "university", country: "Nigeria", city: "Oyo" },
      { name: "Al-Ansar University, Maiduguri", type: "university", country: "Nigeria", city: "Maiduguri" },
      { name: "Al-Hikmah University", type: "university", country: "Nigeria", city: "Ilorin" },
      { name: "Al-Qalam University", type: "university", country: "Nigeria", city: "Katsina" },
      { name: "American University of Nigeria", type: "university", country: "Nigeria", city: "Yola" },
      { name: "Anchor University", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Arthur Jarvis University", type: "university", country: "Nigeria", city: "Akpabuyo" },
      { name: "Ave Maria University", type: "university", country: "Nigeria", city: "Piyanko" },
      { name: "Babcock University", type: "university", country: "Nigeria", city: "Ilishan-Remo" },
      { name: "Baze University", type: "university", country: "Nigeria", city: "Abuja" },
      { name: "Bells University of Technology", type: "university", country: "Nigeria", city: "Ota" },
      { name: "Benson Idahosa University", type: "university", country: "Nigeria", city: "Benin City" },
      { name: "Bowen University", type: "university", country: "Nigeria", city: "Iwo" },
      { name: "Bingham University", type: "university", country: "Nigeria", city: "Karu" },
      { name: "Caleb University", type: "university", country: "Nigeria", city: "Ikorodu" },
      { name: "Caritas University", type: "university", country: "Nigeria", city: "Enugu" },
      { name: "CETEP City University", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Claretian University", type: "university", country: "Nigeria", city: "Nekede" },
      { name: "Chrisland University", type: "university", country: "Nigeria", city: "Abeokuta" },
      { name: "Christopher University", type: "university", country: "Nigeria", city: "Mowe" },
      { name: "Clifford University", type: "university", country: "Nigeria", city: "Owerrinta" },
      { name: "Coal City University", type: "university", country: "Nigeria", city: "Enugu" },
      { name: "Covenant University", type: "university", country: "Nigeria", city: "Ota" },
      { name: "Crawford University", type: "university", country: "Nigeria", city: "Igbesa" },
      { name: "Crescent University", type: "university", country: "Nigeria", city: "Abeokuta" },
      { name: "Dominican University, Ibadan", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "Edwin Clark University", type: "university", country: "Nigeria", city: "Kiagbodo" },
      { name: "Elizade University", type: "university", country: "Nigeria", city: "Ilara-Mokin" },
      { name: "Evangel University, Akaeze", type: "university", country: "Nigeria", city: "Akaeze" },
      { name: "Fountain University", type: "university", country: "Nigeria", city: "Osogbo" },
      { name: "Godfrey Okoye University", type: "university", country: "Nigeria", city: "Enugu" },
      { name: "Greenfield University", type: "university", country: "Nigeria", city: "Kaduna" },
      { name: "Gregory University", type: "university", country: "Nigeria", city: "Uturu" },
      { name: "Hallmark University", type: "university", country: "Nigeria", city: "Ijebu-Itele" },
      { name: "Hezekiah University", type: "university", country: "Nigeria", city: "Umudi" },
      { name: "Igbinedion University", type: "university", country: "Nigeria", city: "Okada" },
      { name: "Joseph Ayo Babalola University", type: "university", country: "Nigeria", city: "Ikeji-Arakeji" },
      { name: "Khadija University, Majia", type: "university", country: "Nigeria", city: "Majia" },
      { name: "Kings University", type: "university", country: "Nigeria", city: "Odeomu" },
      { name: "Koladaisi University", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "Kwararafa University", type: "university", country: "Nigeria", city: "Wukari" },
      { name: "Landmark University", type: "university", country: "Nigeria", city: "Omu-Aran" },
      { name: "Lead City University", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "Madonna University", type: "university", country: "Nigeria", city: "Elele" },
      { name: "McPherson University", type: "university", country: "Nigeria", city: "Seriki-Sotayo" },
      { name: "Mewar University", type: "university", country: "Nigeria", city: "Masaka" },
      { name: "Michael and Cecilia Ibru University", type: "university", country: "Nigeria", city: "Agbara-Otor" },
      { name: "Mountain Top University", type: "university", country: "Nigeria", city: "Makogi Oba" },
      { name: "Mudiame University", type: "university", country: "Nigeria", city: "Irrua" },
      { name: "Nigerian University of Technology and Management", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Nile University of Nigeria", type: "university", country: "Nigeria", city: "Abuja" },
      { name: "Nok University, Kachia", type: "university", country: "Nigeria", city: "Kachia" },
      { name: "Novena University", type: "university", country: "Nigeria", city: "Ogume" },
      { name: "Obong University", type: "university", country: "Nigeria", city: "Obong Ntak" },
      { name: "Oduduwa University", type: "university", country: "Nigeria", city: "Ipetumodu" },
      { name: "PAMO University of Medical Sciences", type: "university", country: "Nigeria", city: "Port Harcourt" },
      { name: "Pan-Atlantic University", type: "university", country: "Nigeria", city: "Lekki" },
      { name: "Paul University", type: "university", country: "Nigeria", city: "Awka" },
      { name: "Peaceland University", type: "university", country: "Nigeria", city: "Enugu" },
      { name: "Precious Cornerstone University", type: "university", country: "Nigeria", city: "Ibadan" },
      { name: "Redeemer's University", type: "university", country: "Nigeria", city: "Ede" },
      { name: "Renaissance University", type: "university", country: "Nigeria", city: "Ugbawka" },
      { name: "Rhema University", type: "university", country: "Nigeria", city: "Aba" },
      { name: "Ritman University", type: "university", country: "Nigeria", city: "Ikot Ekpene" },
      { name: "Salem University", type: "university", country: "Nigeria", city: "Lokoja" },
      { name: "Sam Maris University", type: "university", country: "Nigeria", city: "Supare" },
      { name: "Samuel Adegboyega University", type: "university", country: "Nigeria", city: "Ogwa" },
      { name: "Skyline University, Kano", type: "university", country: "Nigeria", city: "Kano" },
      { name: "Summit University, Offa", type: "university", country: "Nigeria", city: "Offa" },
      { name: "Veritas University", type: "university", country: "Nigeria", city: "Bwari" },
      { name: "Wesley University", type: "university", country: "Nigeria", city: "Ondo" },
      { name: "Western Delta University", type: "university", country: "Nigeria", city: "Oghara" },
      { name: "Westland University, Iwo", type: "university", country: "Nigeria", city: "Iwo" },
      { name: "University of Mkar", type: "university", country: "Nigeria", city: "Mkar" },
      { name: "James Hope University, Lagos", type: "university", country: "Nigeria", city: "Lagos" },
      { name: "Legacy University, Okija", type: "university", country: "Nigeria", city: "Okija" },

      // ── Polytechnics ──
      { name: "Yaba College of Technology", type: "polytechnic", country: "Nigeria", city: "Lagos" },
      { name: "Federal Polytechnic, Ilaro", type: "polytechnic", country: "Nigeria", city: "Ilaro" },
      { name: "Kaduna Polytechnic", type: "polytechnic", country: "Nigeria", city: "Kaduna" },
      { name: "Federal Polytechnic, Bida", type: "polytechnic", country: "Nigeria", city: "Bida" },
      { name: "Federal Polytechnic, Offa", type: "polytechnic", country: "Nigeria", city: "Offa" },
      { name: "Federal Polytechnic, Oko", type: "polytechnic", country: "Nigeria", city: "Oko" },
      { name: "Federal Polytechnic, Nasarawa", type: "polytechnic", country: "Nigeria", city: "Nasarawa" },
      { name: "Federal Polytechnic, Ado-Ekiti", type: "polytechnic", country: "Nigeria", city: "Ado-Ekiti" },
      { name: "Federal Polytechnic, Idah", type: "polytechnic", country: "Nigeria", city: "Idah" },
      { name: "Federal Polytechnic, Ekowe", type: "polytechnic", country: "Nigeria", city: "Ekowe" },
      { name: "Federal Polytechnic, Bauchi", type: "polytechnic", country: "Nigeria", city: "Bauchi" },
      { name: "Federal Polytechnic, Damaturu", type: "polytechnic", country: "Nigeria", city: "Damaturu" },
      { name: "Federal Polytechnic, Mubi", type: "polytechnic", country: "Nigeria", city: "Mubi" },
      { name: "Federal Polytechnic, Nekede", type: "polytechnic", country: "Nigeria", city: "Nekede" },
      { name: "Federal Polytechnic, Kaura Namoda", type: "polytechnic", country: "Nigeria", city: "Kaura Namoda" },
      { name: "Akanu Ibiam Federal Polytechnic, Unwana", type: "polytechnic", country: "Nigeria", city: "Unwana" },
      { name: "Hussaini Adamu Federal Polytechnic, Kazaure", type: "polytechnic", country: "Nigeria", city: "Kazaure" },
      { name: "Waziri Umaru Federal Polytechnic, Birnin Kebbi", type: "polytechnic", country: "Nigeria", city: "Birnin Kebbi" },
      { name: "Federal Polytechnic, Bali", type: "polytechnic", country: "Nigeria", city: "Bali" },
      { name: "Rufus Giwa Polytechnic, Owo", type: "polytechnic", country: "Nigeria", city: "Owo" },
      { name: "Moshood Abiola Polytechnic, Abeokuta", type: "polytechnic", country: "Nigeria", city: "Abeokuta" },
      { name: "Gateway ICT Polytechnic, Saapade", type: "polytechnic", country: "Nigeria", city: "Saapade" },
      { name: "Lagos City Polytechnic", type: "polytechnic", country: "Nigeria", city: "Lagos" },
      { name: "Grace Polytechnic, Lagos", type: "polytechnic", country: "Nigeria", city: "Lagos" },
      { name: "Institute of Management and Technology (IMT), Enugu", type: "polytechnic", country: "Nigeria", city: "Enugu" },
      { name: "Benue State Polytechnic, Ugbokolo", type: "polytechnic", country: "Nigeria", city: "Ugbokolo" },
      { name: "Rivers State Polytechnic, Bori", type: "polytechnic", country: "Nigeria", city: "Bori" },
      { name: "Kogi State Polytechnic, Lokoja", type: "polytechnic", country: "Nigeria", city: "Lokoja" },
      { name: "Nasarawa State Polytechnic, Lafia", type: "polytechnic", country: "Nigeria", city: "Lafia" },
      { name: "Ondo State Polytechnic, Owo", type: "polytechnic", country: "Nigeria", city: "Owo" },
      { name: "Osun State Polytechnic, Iree", type: "polytechnic", country: "Nigeria", city: "Iree" },
      { name: "Osun State College of Technology, Esa-Oke", type: "polytechnic", country: "Nigeria", city: "Esa-Oke" },
      { name: "Delta State Polytechnic, Ogwashi-Uku", type: "polytechnic", country: "Nigeria", city: "Ogwashi-Uku" },
      { name: "Delta State Polytechnic, Ozoro", type: "polytechnic", country: "Nigeria", city: "Ozoro" },
      { name: "Delta State Polytechnic, Otefe", type: "polytechnic", country: "Nigeria", city: "Otefe" },
      { name: "Abia State Polytechnic, Aba", type: "polytechnic", country: "Nigeria", city: "Aba" },
      { name: "Akwa Ibom State Polytechnic, Ikot Osurua", type: "polytechnic", country: "Nigeria", city: "Ikot Osurua" },
      { name: "Imo State Polytechnic, Umuagwo", type: "polytechnic", country: "Nigeria", city: "Umuagwo" },
      { name: "Kwara State Polytechnic, Ilorin", type: "polytechnic", country: "Nigeria", city: "Ilorin" },
      { name: "Niger State Polytechnic, Zungeru", type: "polytechnic", country: "Nigeria", city: "Zungeru" },
      { name: "Plateau State Polytechnic, Barkin-Ladi", type: "polytechnic", country: "Nigeria", city: "Barkin-Ladi" },
      { name: "Edo State Polytechnic, Usen", type: "polytechnic", country: "Nigeria", city: "Usen" },
      { name: "Ogun State Polytechnic of Health and Allied Sciences, Ilese", type: "polytechnic", country: "Nigeria", city: "Ilese" },
    ];
    let created = 0;
    for (const seed of seeds) {
      try {
        await prisma.university.create({ data: seed });
        created++;
      } catch {}
    }
    res.json({ created, message: `Seeded ${created} universities` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
