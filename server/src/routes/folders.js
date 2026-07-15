import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper: generate unique 8-char folder share token
async function generateFolderShareToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  let unique = false;
  while (!unique) {
    token = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const existing = await prisma.folder.findUnique({ where: { shareToken: token } }).catch(() => null);
    if (!existing) unique = true;
  }
  return token;
}

// Helper: check if user can access a folder
async function canAccessFolder(userId, folder) {
  if (!folder) return false;
  if (folder.ownerId === userId) return true;
  if (folder.visibility === "link" && folder.shareToken) return true;
  if (folder.visibility === "shared") {
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId },
      select: { departmentId: true },
    }).catch(() => null);
    if (!userDept) return false;
    const folderDept = await prisma.folderDepartment.findUnique({
      where: { folderId_departmentId: { folderId: folder.id, departmentId: userDept.departmentId } },
    }).catch(() => null);
    return !!folderDept;
  }
  return false;
}

// POST /api/folders — Create a folder
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, courseCode, visibility, departmentIds, level, semester } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { role: true },
    });

    const isStaff = user?.role === "TEACHER" || user?.role === "LECTURER";

    // Students can only create private folders; staff can create shared ones
    let finalVisibility = "private";
    if (isStaff && (visibility === "shared" || visibility === "link")) {
      finalVisibility = visibility;
    } else if (visibility === "link") {
      finalVisibility = "link";
    }

    let shareToken = null;
    if (finalVisibility === "link") {
      shareToken = await generateFolderShareToken();
    }

    // Parse departmentIds for shared folders
    let parsedDeptIds = [];
    if (finalVisibility === "shared" && departmentIds) {
      parsedDeptIds = Array.isArray(departmentIds) ? departmentIds : [departmentIds];
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        courseCode: courseCode?.trim() || null,
        ownerId: req.user.sub,
        visibility: finalVisibility,
        level: level || null,
        semester: semester || null,
        shareToken,
        folderDepts: parsedDeptIds.length > 0 ? {
          create: parsedDeptIds.map((deptId) => ({ departmentId: deptId })),
        } : undefined,
      },
      include: {
        folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
        owner: { select: { id: true, username: true, role: true } },
      },
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: error.message || "Failed to create folder" });
  }
});

// GET /api/folders — List folders visible to the caller
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    // Get user's department for shared folder filtering
    const userDept = await prisma.userDepartment.findUnique({
      where: { userId },
      select: { departmentId: true },
    }).catch(() => null);

    // Own folders
    const ownFolders = await prisma.folder.findMany({
      where: { ownerId: userId },
      include: {
        folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
        owner: { select: { id: true, username: true, role: true } },
        _count: { select: { resources: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Shared folders in user's department
    let sharedFolders = [];
    if (userDept) {
      const folderDeptLinks = await prisma.folderDepartment.findMany({
        where: { departmentId: userDept.departmentId },
        select: { folderId: true },
      });
      const sharedFolderIds = folderDeptLinks.map((fd) => fd.folderId);

      if (sharedFolderIds.length > 0) {
        sharedFolders = await prisma.folder.findMany({
          where: {
            id: { in: sharedFolderIds },
            ownerId: { not: userId },
            visibility: "shared",
          },
          include: {
            folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
            owner: { select: { id: true, username: true, role: true } },
            _count: { select: { resources: true } },
          },
          orderBy: { updatedAt: "desc" },
        });
      }
    }

    res.json({
      own: ownFolders,
      shared: sharedFolders,
    });
  } catch (error) {
    console.error("Error listing folders:", error);
    res.status(500).json({ error: "Failed to list folders" });
  }
});

// GET /api/folders/shared/:shareToken — Open a link-shared folder
router.get("/shared/:shareToken", requireAuth, async (req, res) => {
  try {
    const { shareToken } = req.params;
    const folder = await prisma.folder.findUnique({
      where: { shareToken },
      include: {
        folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
        owner: { select: { id: true, username: true, role: true } },
      },
    });

    if (!folder || folder.visibility !== "link") {
      return res.status(404).json({ error: "Folder not found" });
    }

    const resources = await prisma.resource.findMany({
      where: {
        folderId: folder.id,
        status: { in: ["approved"] },
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        _count: { select: { bookmarks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...folder, resources });
  } catch (error) {
    console.error("Error fetching shared folder:", error);
    res.status(500).json({ error: "Failed to fetch folder" });
  }
});

// GET /api/folders/:id — Get folder detail with resources split into shared + mine
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const folder = await prisma.folder.findUnique({
      where: { id },
      include: {
        folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
        owner: { select: { id: true, username: true, role: true } },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const hasAccess = await canAccessFolder(userId, folder);
    if (!hasAccess) {
      return res.status(403).json({ error: "You don't have access to this folder" });
    }

    // Shared/approved resources (visible to everyone with access)
    const sharedResources = await prisma.resource.findMany({
      where: {
        folderId: folder.id,
        status: "approved",
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        _count: { select: { bookmarks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Caller's own resources in this folder (private + pending)
    const myResources = await prisma.resource.findMany({
      where: {
        folderId: folder.id,
        uploadedBy: userId,
        status: { in: ["private", "pending", "rejected"] },
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
        _count: { select: { bookmarks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ...folder,
      sharedResources,
      myResources,
    });
  } catch (error) {
    console.error("Error fetching folder:", error);
    res.status(500).json({ error: "Failed to fetch folder" });
  }
});

// GET /api/folders/:id/pending — Get pending student contributions (staff only)
router.get("/:id/pending", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Only the folder owner or staff with dept access can see pending
    const hasAccess = await canAccessFolder(userId, folder);
    if (!hasAccess) {
      return res.status(403).json({ error: "You don't have access to this folder" });
    }

    const pending = await prisma.resource.findMany({
      where: {
        folderId: folder.id,
        status: "pending",
      },
      include: {
        uploader: { select: { id: true, username: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(pending);
  } catch (error) {
    console.error("Error fetching pending:", error);
    res.status(500).json({ error: "Failed to fetch pending contributions" });
  }
});

// PATCH /api/folders/:id — Update folder (owner only)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, courseCode, visibility, departmentIds, generateShareToken, level, semester } = req.body;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }
    if (folder.ownerId !== req.user.sub) {
      return res.status(403).json({ error: "Only the owner can update this folder" });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (courseCode !== undefined) data.courseCode = courseCode?.trim() || null;
    if (level !== undefined) data.level = level || null;
    if (semester !== undefined) data.semester = semester || null;

    if (visibility !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { role: true },
      });
      const isStaff = user?.role === "TEACHER" || user?.role === "LECTURER";

      if (visibility === "shared" && !isStaff) {
        return res.status(403).json({ error: "Only teachers/lecturers can create shared folders" });
      }
      data.visibility = visibility;

      // Generate share token if switching to link visibility
      if (visibility === "link" && !folder.shareToken) {
        data.shareToken = await generateFolderShareToken();
      }
    }

    // Handle explicit share token generation request
    if (generateShareToken && !folder.shareToken) {
      data.shareToken = await generateFolderShareToken();
      if (folder.visibility !== "link") data.visibility = "link";
    }

    // Update department assignments if provided
    if (departmentIds !== undefined && data.visibility === "shared") {
      // Replace all department associations
      await prisma.folderDepartment.deleteMany({ where: { folderId: id } });
      if (Array.isArray(departmentIds) && departmentIds.length > 0) {
        await prisma.folderDepartment.createMany({
          data: departmentIds.map((deptId) => ({ folderId: id, departmentId: deptId })),
        });
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data,
      include: {
        folderDepts: { include: { department: { select: { id: true, name: true, icon: true } } } },
        owner: { select: { id: true, username: true, role: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating folder:", error);
    res.status(500).json({ error: error.message || "Failed to update folder" });
  }
});

// DELETE /api/folders/:id — Delete folder (owner only, detaches resources)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }
    if (folder.ownerId !== req.user.sub) {
      return res.status(403).json({ error: "Only the owner can delete this folder" });
    }

    // Detach all resources (set folderId to null, don't delete files)
    await prisma.resource.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    // Delete folder dept associations (cascade handles this, but explicit for safety)
    await prisma.folderDepartment.deleteMany({ where: { folderId: id } });

    await prisma.folder.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting folder:", error);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

export default router;
