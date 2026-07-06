import { API_BASE as BASE } from "./constants.js";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

export async function getUniversities(query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const res = await authFetch(`${BASE}/api/universities${params.toString() ? `?${params}` : ""}`);
  if (!res.ok) throw new Error("Failed to load universities");
  return res.json();
}

export async function getUniversity(id) {
  const res = await authFetch(`${BASE}/api/universities/${id}`);
  if (!res.ok) throw new Error("Failed to load university");
  return res.json();
}

export async function getUniversityDepartments(universityId) {
  const res = await authFetch(`${BASE}/api/universities/${universityId}/departments`);
  if (!res.ok) throw new Error("Failed to load departments");
  return res.json();
}

export async function createUniversity(name, type = "university", country = "Nigeria", city = null) {
  const res = await authFetch(`${BASE}/api/universities`, {
    method: "POST",
    body: JSON.stringify({ name, type, country, city }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create university");
  }
  return res.json();
}

export async function createUniversityDepartment(universityId, name, icon) {
  const res = await authFetch(`${BASE}/api/universities/${universityId}/departments`, {
    method: "POST",
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create department");
  }
  return res.json();
}

export async function seedUniversities() {
  const res = await authFetch(`${BASE}/api/universities/seed`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed universities");
  return res.json();
}

// Predefined list for instant UI rendering before API responds
export const FALLBACK_UNIVERSITIES = [
  // Federal
  "Abubakar Tafawa Balewa University",
  "Adeyemi Federal University of Education",
  "Admiralty University, Ibusa",
  "Ahmadu Bello University",
  "Air Force Institute of Technology",
  "Alex Ekwueme Federal University, Ndufu-Alike Ikwo",
  "Alvan Ikoku Federal University of Education",
  "Bayero University, Kano",
  "Federal University, Birnin Kebbi",
  "Federal University, Dutse",
  "Federal University, Dutsin-Ma",
  "Federal University, Gashua",
  "Federal University, Gusau",
  "Federal University, Kashere",
  "Federal University, Lokoja",
  "Federal University of Lafia",
  "Federal University of Agriculture, Abeokuta",
  "Federal University of Agriculture, Mubi",
  "Federal University of Agriculture, Zuru",
  "Federal University of Applied Sciences, Kachia",
  "Federal University of Education, Pankshin",
  "Federal University of Education, Zaria",
  "Federal University of Health Sciences, Azare",
  "Federal University of Petroleum Resources, Effurun",
  "Federal University of Technology, Akure",
  "Federal University of Technology, Minna",
  "Federal University of Technology, Owerri",
  "Federal University of Transportation, Daura",
  "Federal University, Otuoke",
  "Federal University, Oye-Ekiti",
  "Federal University, Wukari",
  "Joseph Sarwuan Tarka University, Makurdi",
  "Michael Okpara University of Agriculture, Umudike",
  "Modibbo Adama University, Yola",
  "National Open University of Nigeria",
  "Nigeria Police Academy, Wudil",
  "Nigerian Army University, Biu",
  "Nigerian Defence Academy",
  "Nigerian Maritime University",
  "Nnamdi Azikiwe University",
  "Obafemi Awolowo University",
  "Tai Solarin Federal University of Education",
  "University of Abuja",
  "University of Benin",
  "University of Calabar",
  "University of Ibadan",
  "University of Ilorin",
  "University of Jos",
  "University of Lagos",
  "University of Maiduguri",
  "University of Nigeria, Nsukka",
  "University of Port Harcourt",
  "University of Uyo",
  "Usmanu Danfodiyo University",
  "Yusuf Maitama Sule Federal University of Education, Kano",
  // State
  "Abdulkadir Kure University, Minna",
  "Abia State University",
  "Abiola Ajimobi Technical University",
  "Adamawa State University",
  "Adekunle Ajasin University",
  "Akwa Ibom State University",
  "Aliko Dangote University of Science and Technology, Wudil",
  "Ambrose Alli University",
  "Bauchi State University",
  "Bayelsa Medical University",
  "Benue State University",
  "Borno State University",
  "Chukwuemeka Odumegwu Ojukwu University",
  "Delta State University, Abraka",
  "Delta State University of Science and Technology, Ozoro",
  "Dennis Osadebay University",
  "Ebonyi State University",
  "Edo State University, Uzairue",
  "Ekiti State University",
  "Emmanuel Alayande University of Education",
  "Enugu State University of Science and Technology",
  "Gombe State University",
  "Gombe State University of Science and Technology, Kumo",
  "Ibrahim Badamasi Babangida University, Lapai",
  "Ignatius Ajuru University of Education",
  "Imo State University",
  "Kaduna State University",
  "Kebbi State University of Science and Technology, Aliero",
  "Kingsley Ozumba Mbadiwe University",
  "Kwara State University",
  "Prince Abubakar Audu University",
  "Ladoke Akintola University of Technology",
  "Lagos State University",
  "Lagos State University of Education",
  "Lagos State University of Science and Technology",
  "Nasarawa State University, Keffi",
  "Niger Delta University",
  "Olabisi Onabanjo University",
  "Olusegun Agagu University of Science and Technology",
  "Osun State University",
  "Plateau State University",
  "Rivers State University",
  "Sule Lamido University",
  "Taraba State University",
  "Umaru Musa Yar'adua University",
  "University of Cross River State",
  "Sokoto State University",
  "University of Delta, Agbor",
  "Yobe State University, Damaturu",
  "Yusuf Maitama Sule University, Kano",
  "Zamfara State University",
  // Private
  "Achievers University",
  "Adeleke University",
  "Afe Babalola University",
  "African University of Science and Technology, Abuja",
  "Ahman Pategi University",
  "Ajayi Crowther University",
  "Al-Ansar University, Maiduguri",
  "Al-Hikmah University",
  "Al-Qalam University",
  "American University of Nigeria",
  "Anchor University",
  "Arthur Jarvis University",
  "Ave Maria University",
  "Babcock University",
  "Baze University",
  "Bells University of Technology",
  "Benson Idahosa University",
  "Bowen University",
  "Bingham University",
  "Caleb University",
  "Caritas University",
  "CETEP City University",
  "Claretian University",
  "Chrisland University",
  "Christopher University",
  "Clifford University",
  "Coal City University",
  "Covenant University",
  "Crawford University",
  "Crescent University",
  "Dominican University, Ibadan",
  "Edwin Clark University",
  "Elizade University",
  "Evangel University, Akaeze",
  "Fountain University",
  "Godfrey Okoye University",
  "Greenfield University",
  "Gregory University",
  "Hallmark University",
  "Hezekiah University",
  "Igbinedion University",
  "Joseph Ayo Babalola University",
  "Khadija University, Majia",
  "Kings University",
  "Koladaisi University",
  "Kwararafa University",
  "Landmark University",
  "Lead City University",
  "Madonna University",
  "McPherson University",
  "Mewar University",
  "Michael and Cecilia Ibru University",
  "Mountain Top University",
  "Mudiame University",
  "Nigerian University of Technology and Management",
  "Nile University of Nigeria",
  "Nok University, Kachia",
  "Novena University",
  "Obong University",
  "Oduduwa University",
  "PAMO University of Medical Sciences",
  "Pan-Atlantic University",
  "Paul University",
  "Peaceland University",
  "Precious Cornerstone University",
  "Redeemer's University",
  "Renaissance University",
  "Rhema University",
  "Ritman University",
  "Salem University",
  "Sam Maris University",
  "Samuel Adegboyega University",
  "Skyline University, Kano",
  "Summit University, Offa",
  "Veritas University",
  "Wesley University",
  "Western Delta University",
  "Westland University, Iwo",
  "University of Mkar",
  "James Hope University, Lagos",
  "Legacy University, Okija",
  // Polytechnics
  "Yaba College of Technology",
  "Federal Polytechnic, Ilaro",
  "Kaduna Polytechnic",
  "Federal Polytechnic, Bida",
  "Federal Polytechnic, Offa",
  "Federal Polytechnic, Oko",
  "Federal Polytechnic, Nasarawa",
  "Federal Polytechnic, Ado-Ekiti",
  "Federal Polytechnic, Idah",
  "Federal Polytechnic, Ekowe",
  "Federal Polytechnic, Bauchi",
  "Federal Polytechnic, Damaturu",
  "Federal Polytechnic, Mubi",
  "Federal Polytechnic, Nekede",
  "Federal Polytechnic, Kaura Namoda",
  "Akanu Ibiam Federal Polytechnic, Unwana",
  "Hussaini Adamu Federal Polytechnic, Kazaure",
  "Waziri Umaru Federal Polytechnic, Birnin Kebbi",
  "Federal Polytechnic, Bali",
  "Rufus Giwa Polytechnic, Owo",
  "Moshood Abiola Polytechnic, Abeokuta",
  "Gateway ICT Polytechnic, Saapade",
  "Lagos City Polytechnic",
  "Grace Polytechnic, Lagos",
  "Institute of Management and Technology (IMT), Enugu",
  "Benue State Polytechnic, Ugbokolo",
  "Rivers State Polytechnic, Bori",
  "Kogi State Polytechnic, Lokoja",
  "Nasarawa State Polytechnic, Lafia",
  "Ondo State Polytechnic, Owo",
  "Osun State Polytechnic, Iree",
  "Osun State College of Technology, Esa-Oke",
  "Delta State Polytechnic, Ogwashi-Uku",
  "Delta State Polytechnic, Ozoro",
  "Delta State Polytechnic, Otefe",
  "Abia State Polytechnic, Aba",
  "Akwa Ibom State Polytechnic, Ikot Osurua",
  "Imo State Polytechnic, Umuagwo",
  "Kwara State Polytechnic, Ilorin",
  "Niger State Polytechnic, Zungeru",
  "Plateau State Polytechnic, Barkin-Ladi",
  "Edo State Polytechnic, Usen",
  "Ogun State Polytechnic of Health and Allied Sciences, Ilese",
];
