async function loadProfile(){

try{

const res = await fetch("http://localhost:3000/api/profile");

if(!res.ok){
throw new Error("API error");
}

const user = await res.json();

/* NAME */

const nameEl = document.getElementById("profileName");
if(nameEl){
nameEl.textContent = user.first_name + " " + user.last_name;
}

/* BIO */

const bioEl = document.getElementById("profileBio");
if(bioEl){
bioEl.textContent = user.bio || "No bio";
}

/* BASIC INFO */

document.getElementById("firstName").textContent = user.first_name || "";
document.getElementById("lastName").textContent = user.last_name || "";
document.getElementById("gender").textContent = user.gender || "";
document.getElementById("faculty").textContent = user.faculty || "";
document.getElementById("social").textContent = user.social || "";

/* BIRTHDAY FORMAT */

if(user.birthday){
const date = new Date(user.birthday);
document.getElementById("birthday").textContent =
date.toLocaleDateString("th-TH");
}

/* AVATAR */

if(user.avatar){
const avatar = document.getElementById("profileAvatar");
if(avatar){
avatar.src = `http://localhost:3000/${user.avatar}`;
}
}

/* TAGS */

const tagList = document.getElementById("tagList");

if(tagList && user.tags){

tagList.innerHTML = "";

user.tags.forEach(tag=>{

const chip = document.createElement("span");
chip.className = "profile-tag-chip";
chip.textContent = "#" + tag;

tagList.appendChild(chip);

});

}

}catch(err){
console.error("Profile load error:",err);
}

}

document.addEventListener("DOMContentLoaded",loadProfile);