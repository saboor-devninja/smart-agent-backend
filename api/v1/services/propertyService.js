const Property = require("../../../models/Property");
const PropertyUtility = require("../../../models/PropertyUtility");
const PropertyMedia = require("../../../models/PropertyMedia");
const Landlord = require("../../../models/Landlord");
const AppError = require("../../../utils/appError");
const { uploadFile, generatePropertyMediaPath, deleteFile } = require("../../../utils/s3");
const { formatDateForStorage } = require("../../../utils/dateUtils");

class PropertyService {
  static async createProperty(data, agentId, agencyId, utilities = [], mediaFiles = []) {
    const landlord = await Landlord.findById(data.landlordId);
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    let propertyAgentId = agentId;
    if (landlord.agentId) {
      propertyAgentId = landlord.agentId;
    }

    const platformFeePercentage = !data.commissionType || data.commissionType === 'NONE' 
      ? 5.0 
      : 20.0;
    const propertyData = {
      agentId: propertyAgentId,
      landlordId: data.landlordId,
      agencyId: agencyId || null,
      type: data.type || 'OTHER',
      title: data.title,
      description: data.description || null,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      area: data.area,
      areaUnit: data.areaUnit || 'SQ_FT',
      yearBuilt: data.yearBuilt || null,
      furnished: data.furnished || false,
      isAvailable: data.isAvailable !== false,
      rentAmount: data.rentAmount || null,
      rentalCycle: data.rentalCycle || 'MONTHLY',
      securityDeposit: data.securityDeposit || null,
      minimumLease: data.minimumLease || null,
      maximumLease: data.maximumLease || null,
      petPolicy: data.petPolicy || null,
      petsAllowed: data.petsAllowed || false,
      smokingAllowed: data.smokingAllowed || false,
      maxOccupants: data.maxOccupants || null,
      parking: data.parking || false,
      parkingSpaces: data.parkingSpaces || 0,
      amenities: data.amenities || null,
      availableFrom: data.availableFrom ? formatDateForStorage(data.availableFrom) : null,
      commissionType: data.commissionType || null,
      commissionPercentage: data.commissionPercentage || null,
      commissionFixedAmount: data.commissionFixedAmount || null,
      commissionFrequency: data.commissionFrequency || null,
      commissionNotes: data.commissionNotes || null,
      platformFeePercentage: platformFeePercentage,
      address: data.address,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };

    const property = await Property.create(propertyData);

    // Create notification for property creation
    try {
      const { notifyPropertyCreated } = require("../../../utils/notificationHelper");
      await notifyPropertyCreated(property._id, propertyAgentId);
    } catch (error) {
      console.error("Error creating property notification:", error);
      // Don't fail property creation if notification fails
    }

    // Create utilities
    if (utilities && utilities.length > 0) {
      const utilityData = utilities.map((utility) => ({
        propertyId: property._id,
        utilityType: utility.utilityType,
        paymentType: utility.paymentType,
      }));
      await PropertyUtility.insertMany(utilityData);
    }

    // Upload and create media files
    if (mediaFiles && mediaFiles.length > 0) {
      const mediaPromises = mediaFiles.map(async (file) => {
        const uploadPath = generatePropertyMediaPath(property._id, file.originalname);
        const uploadResult = await uploadFile(file, uploadPath);

        if (uploadResult.error) {
          console.error(`Failed to upload media file ${file.originalname}:`, uploadResult.error);
          return null;
        }

        // Determine media type
        let mediaType = 'DOCUMENT';
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) mediaType = 'IMAGE';
        else if (['mp4', 'webm', 'mov'].includes(extension || '')) mediaType = 'VIDEO';
        else if (['mp3', 'wav', 'ogg'].includes(extension || '')) mediaType = 'AUDIO';
        else if (extension === 'pdf') mediaType = 'PDF';

        return PropertyMedia.create({
          propertyId: property._id,
          type: mediaType,
          fileUrl: uploadResult.url,
          fileName: file.originalname,
          fileSize: file.size,
        });
      });

      // Use Promise.allSettled to handle individual upload failures
      const mediaResults = await Promise.allSettled(mediaPromises);
      const failedUploads = mediaResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === "rejected");
      
      if (failedUploads.length > 0) {
        console.error(`Failed to upload ${failedUploads.length} media file(s)`);
        // Continue with successful uploads
      }
    }

    return property;
  }

  static async getProperties(filters = {}) {
    const query = {};

    if (filters.agentId) {
      query.agentId = filters.agentId;
    }

    if (filters.agencyId) {
      query.agencyId = filters.agencyId;
    }

    if (filters.landlordId) {
      query.landlordId = filters.landlordId;
    }

    if (filters.isAvailable !== undefined) {
      query.isAvailable = filters.isAvailable;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.city) {
      query.city = new RegExp(filters.city, 'i');
    }

    if (filters.state) {
      query.state = new RegExp(filters.state, 'i');
    }

    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .skip(filters.skip || 0)
      .lean();

    const landlordIds = [...new Set(properties.map(p => p.landlordId).filter(Boolean))];
    const landlords = await Landlord.find({ _id: { $in: landlordIds } })
      .select('_id firstName lastName organizationName isOrganization')
      .lean();

    const landlordMap = {};
    landlords.forEach(landlord => {
      landlordMap[landlord._id] = landlord;
    });

    const propertyIds = properties.map(p => p._id);

    const utilities = await PropertyUtility.find({ propertyId: { $in: propertyIds } }).lean();
    const utilitiesMap = {};
    utilities.forEach(utility => {
      if (!utilitiesMap[utility.propertyId]) {
        utilitiesMap[utility.propertyId] = [];
      }
      utilitiesMap[utility.propertyId].push({
        _id: utility._id,
        utilityType: utility.utilityType,
        paymentType: utility.paymentType,
      });
    });

    let leases = [];
    let leasesMap = {};
    try {
      const Lease = require("../../../models/Lease");
      const Tenant = require("../../../models/Tenant");
      leases = await Lease.find({ propertyId: { $in: propertyIds } })
        .select('_id propertyId leaseNumber status rentAmount startDate endDate tenantId')
        .lean();
      
      const tenantIds = [...new Set(leases.map(l => l.tenantId).filter(Boolean))];
      let tenants = [];
      let tenantMap = {};
      if (tenantIds.length > 0) {
        try {
          tenants = await Tenant.find({ _id: { $in: tenantIds } })
            .select('_id firstName lastName')
            .lean();
          tenants.forEach(tenant => {
            tenantMap[tenant._id] = tenant;
          });
        } catch (err) {
          console.warn("Tenant model not found, skipping tenant data");
        }
      }
      
      leases.forEach(lease => {
        if (!leasesMap[lease.propertyId]) {
          leasesMap[lease.propertyId] = [];
        }
        const tenant = lease.tenantId && tenantMap[lease.tenantId] ? tenantMap[lease.tenantId] : null;
        leasesMap[lease.propertyId].push({
          _id: lease._id,
          leaseNumber: lease.leaseNumber,
          status: lease.status,
          rentAmount: lease.rentAmount ? parseFloat(lease.rentAmount.toString()) : 0,
          startDate: lease.startDate,
          endDate: lease.endDate,
          tenant: tenant ? {
            firstName: tenant.firstName || '',
            lastName: tenant.lastName || '',
          } : undefined,
        });
      });
    } catch (err) {
      console.warn("Lease model not found, skipping lease data");
    }

    const propertiesWithLandlords = properties.map(property => {
      const landlord = landlordMap[property.landlordId];
      if (landlord) {
        property.landlordId = landlord;
      }
      property.utilities = utilitiesMap[property._id] || [];
      property.leases = leasesMap[property._id] || [];
      property.activeLeasesCount = (leasesMap[property._id] || []).filter(l => l.status === 'ACTIVE').length;
      property.hasActiveLease = property.activeLeasesCount > 0;
      property.hasPendingOrDraftLease = (leasesMap[property._id] || []).some(l => l.status === 'PENDING_START' || l.status === 'DRAFT');
      
      const activeOrPendingLeasesCount = (leasesMap[property._id] || []).filter(l => l.status === 'ACTIVE' || l.status === 'PENDING_START').length;
      property.isAvailable = activeOrPendingLeasesCount === 0;
      
      return property;
    });

    return propertiesWithLandlords;
  }

  static async getPropertyById(propertyId) {
    const property = await Property.findById(propertyId).lean();
    
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    const PropertyUtility = require("../../../models/PropertyUtility");
    const PropertyMedia = require("../../../models/PropertyMedia");

    // Add null check for landlordId before querying
    if (property.landlordId) {
      const landlord = await Landlord.findById(property.landlordId)
        .select('_id firstName lastName organizationName isOrganization')
        .lean();

      if (landlord) {
        property.landlordId = landlord;
      } else {
        // Landlord was deleted, set to null to prevent errors
        property.landlordId = null;
      }
    }

    const utilities = await PropertyUtility.find({ propertyId: property._id }).lean();
    property.utilities = utilities.map(u => ({
      _id: u._id,
      utilityType: u.utilityType,
      paymentType: u.paymentType,
    }));

    const media = await PropertyMedia.find({ propertyId: property._id })
      .sort({ createdAt: 1 })
      .lean();
    property.media = media.map(m => ({
      _id: m._id,
      type: m.type,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      fileSize: m.fileSize,
      description: m.description,
    }));

    let activeLeasesCount = 0;
    let hasActiveLease = false;
    let hasPendingOrDraftLease = false;
    let activeOrPendingLeasesCount = 0;
    
    // Improved error handling for lease queries
    try {
      const Lease = require("../../../models/Lease");
      const Tenant = require("../../../models/Tenant");
      const leases = await Lease.find({ propertyId: property._id })
        .select('_id propertyId leaseNumber status rentAmount startDate endDate tenantId')
        .lean();
      
      const tenantIds = [...new Set(leases.map(l => l.tenantId).filter(Boolean))];
      let tenantMap = {};
      if (tenantIds.length > 0) {
        try {
          const tenants = await Tenant.find({ _id: { $in: tenantIds } })
            .select('_id firstName lastName')
            .lean();
          tenants.forEach(tenant => {
            tenantMap[tenant._id] = tenant;
          });
        } catch (err) {
          console.warn("Tenant model not found, skipping tenant data");
        }
      }
      
      leases.forEach(lease => {
        if (lease.status === 'ACTIVE') {
          activeLeasesCount++;
          hasActiveLease = true;
          activeOrPendingLeasesCount++;
        }
        if (lease.status === 'PENDING_START') {
          activeOrPendingLeasesCount++;
          hasPendingOrDraftLease = true;
        }
        if (lease.status === 'DRAFT') {
          hasPendingOrDraftLease = true;
        }
      });
    } catch (err) {
      console.warn("Lease model not found, skipping lease data");
    }

    property.activeLeasesCount = activeLeasesCount;
    property.hasActiveLease = hasActiveLease;
    property.hasPendingOrDraftLease = hasPendingOrDraftLease;
    property.isAvailable = activeOrPendingLeasesCount === 0;

    return property;
  }

  static async updateProperty(propertyId, data, userId, userRole, agencyId, utilities = [], mediaFiles = []) {
    const property = await Property.findById(propertyId);
    
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    // Authorization is handled in middleware

    const updateData = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.areaUnit !== undefined) updateData.areaUnit = data.areaUnit;
    if (data.yearBuilt !== undefined) updateData.yearBuilt = data.yearBuilt;
    if (data.furnished !== undefined) updateData.furnished = data.furnished;
    if (data.isAvailable !== undefined) {
      const Lease = require("../../../models/Lease");
      const activeOrPendingLeases = await Lease.countDocuments({
        propertyId,
        status: { $in: ['ACTIVE', 'PENDING_START'] }
      });
      
      if (activeOrPendingLeases > 0 && data.isAvailable === true) {
        throw new AppError(
          'Cannot set property as available while it has active or pending leases',
          400
        );
      }
      
      updateData.isAvailable = activeOrPendingLeases === 0 ? data.isAvailable : false;
    }
    if (data.rentAmount !== undefined) updateData.rentAmount = data.rentAmount;
    if (data.rentalCycle !== undefined) updateData.rentalCycle = data.rentalCycle;
    if (data.securityDeposit !== undefined) updateData.securityDeposit = data.securityDeposit;
    if (data.minimumLease !== undefined) updateData.minimumLease = data.minimumLease;
    if (data.maximumLease !== undefined) updateData.maximumLease = data.maximumLease;
    if (data.petPolicy !== undefined) updateData.petPolicy = data.petPolicy;
    if (data.petsAllowed !== undefined) updateData.petsAllowed = data.petsAllowed;
    if (data.smokingAllowed !== undefined) updateData.smokingAllowed = data.smokingAllowed;
    if (data.maxOccupants !== undefined) updateData.maxOccupants = data.maxOccupants;
    if (data.parking !== undefined) updateData.parking = data.parking;
    if (data.parkingSpaces !== undefined) updateData.parkingSpaces = data.parkingSpaces;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.availableFrom !== undefined) updateData.availableFrom = data.availableFrom ? formatDateForStorage(data.availableFrom) : null;
    if (data.commissionType !== undefined) updateData.commissionType = data.commissionType;
    if (data.commissionPercentage !== undefined) updateData.commissionPercentage = data.commissionPercentage;
    if (data.commissionFixedAmount !== undefined) updateData.commissionFixedAmount = data.commissionFixedAmount;
    if (data.commissionFrequency !== undefined) updateData.commissionFrequency = data.commissionFrequency;
    if (data.commissionNotes !== undefined) updateData.commissionNotes = data.commissionNotes;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;

    // Update platform fee if commission type changes
    if (data.commissionType !== undefined) {
      updateData.platformFeePercentage = !data.commissionType || data.commissionType === 'NONE' 
        ? 5.0 
        : 20.0;
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    // Update utilities
    await PropertyUtility.deleteMany({ propertyId: propertyId });
    
    if (utilities && utilities.length > 0) {
      const utilityData = utilities.map((utility) => ({
        propertyId: propertyId,
        utilityType: utility.utilityType,
        paymentType: utility.paymentType,
      }));
      await PropertyUtility.insertMany(utilityData);
    }

    // Fetch utilities to attach to the returned property
    const updatedUtilities = await PropertyUtility.find({ propertyId: propertyId }).lean();
    updatedProperty.utilities = updatedUtilities.map(u => ({
      _id: u._id,
      utilityType: u.utilityType,
      paymentType: u.paymentType,
    }));

    // Delete media files if specified
    if (data.mediaToDelete && Array.isArray(data.mediaToDelete) && data.mediaToDelete.length > 0) {
      const mediaToDelete = await PropertyMedia.find({ 
        _id: { $in: data.mediaToDelete },
        propertyId: propertyId 
      });
      
      for (const media of mediaToDelete) {
        try {
          // Extract S3 key from URL (e.g., https://bucket.s3.region.amazonaws.com/path/to/file.jpg -> path/to/file.jpg)
          const urlParts = media.fileUrl.split('.com/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1].split('?')[0]; // Remove query params if any
            await deleteFile(filePath);
          }
        } catch (error) {
          console.warn(`Failed to delete media file ${media._id}:`, error);
        }
      }
      
      await PropertyMedia.deleteMany({ 
        _id: { $in: data.mediaToDelete },
        propertyId: propertyId 
      });
    }

    // Handle media files (upload new ones)
    if (mediaFiles && mediaFiles.length > 0) {
      const mediaPromises = mediaFiles.map(async (file) => {
        const uploadPath = generatePropertyMediaPath(propertyId, file.originalname);
        const uploadResult = await uploadFile(file, uploadPath);

        if (uploadResult.error) {
          console.error(`Failed to upload media file ${file.originalname}:`, uploadResult.error);
          return null;
        }

        let mediaType = 'DOCUMENT';
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) mediaType = 'IMAGE';
        else if (['mp4', 'webm', 'mov'].includes(extension || '')) mediaType = 'VIDEO';
        else if (['mp3', 'wav', 'ogg'].includes(extension || '')) mediaType = 'AUDIO';
        else if (extension === 'pdf') mediaType = 'PDF';

        return PropertyMedia.create({
          propertyId: propertyId,
          type: mediaType,
          fileUrl: uploadResult.url,
          fileName: file.originalname,
          fileSize: file.size,
        });
      });

      // Use Promise.allSettled to handle individual upload failures
      const mediaResults = await Promise.allSettled(mediaPromises);
      const failedUploads = mediaResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === "rejected");
      
      if (failedUploads.length > 0) {
        console.error(`Failed to upload ${failedUploads.length} media file(s)`);
        // Continue with successful uploads
      }
    }

    return updatedProperty;
  }

  static async deleteProperty(propertyId, userId, userRole, agencyId) {
    const property = await Property.findById(propertyId);
    
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    // Authorization is handled in middleware

    await Property.findByIdAndDelete(propertyId);
    return true;
  }
}

module.exports = PropertyService;

