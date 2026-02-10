const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    domain: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending' // pending, scanning, completed, failed
    },
    pages: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    links: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    brokenLinks: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    personas: {
        type: DataTypes.JSON,
        defaultValue: []
    }
}, {
    timestamps: true
});

module.exports = Project;
