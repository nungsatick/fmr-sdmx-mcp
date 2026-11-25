export declare const CS_URN = "urn:sdmx:org.sdmx.infomodel.conceptscheme.Concept=TNSO:CS_COMMON(1.0)";
export declare const DATAFLOW_STUBS: {
    data: {
        dataflows: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
        }[];
    };
};
export declare const CATEGORY_SCHEMES: {
    data: {
        categorySchemes: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            categories: {
                id: string;
                names: {
                    th: string;
                };
            }[];
        }[];
    };
};
export declare const CATEGORISATIONS: {
    data: {
        categorisations: {
            id: string;
            agencyID: string;
            version: string;
            source: string;
            target: string;
        }[];
    };
};
export declare const CL_AREA_LATEST: {
    data: {
        codelists: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            codes: ({
                id: string;
                names: {
                    th: string;
                };
                parent?: undefined;
            } | {
                id: string;
                names: {
                    th: string;
                };
                parent: string;
            })[];
        }[];
    };
};
export declare const DATAFLOW_FULL: {
    data: {
        dataflows: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            structure: string;
        }[];
        dataStructures: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            dataStructureComponents: {
                dimensionList: {
                    id: string;
                    dimensions: {
                        id: string;
                        position: number;
                        conceptIdentity: string;
                        localRepresentation: {
                            enumeration: string;
                        };
                    }[];
                    timeDimension: {
                        id: string;
                        conceptIdentity: string;
                    };
                };
                attributeList: {
                    attributes: ({
                        id: string;
                        usage: string;
                        attributeRelationship: {
                            dimensions: string[];
                            observation?: undefined;
                        };
                        conceptIdentity: string;
                    } | {
                        id: string;
                        usage: string;
                        attributeRelationship: {
                            observation: {};
                            dimensions?: undefined;
                        };
                        conceptIdentity: string;
                    })[];
                };
                measureList: {
                    measures: {
                        id: string;
                        localRepresentation: {
                            format: {
                                dataType: string;
                            };
                        };
                    }[];
                };
            };
        }[];
        codelists: ({
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            codes: ({
                id: string;
                names: {
                    th: string;
                };
                parent?: undefined;
            } | {
                id: string;
                names: {
                    th: string;
                };
                parent: string;
            })[];
        } | {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            codes: {
                id: string;
                names: {
                    th: string;
                    en: string;
                };
            }[];
        })[];
        conceptSchemes: {
            id: string;
            agencyID: string;
            version: string;
            concepts: {
                id: string;
                names: {
                    th: string;
                };
            }[];
        }[];
        dataConstraints: {
            id: string;
            agencyID: string;
            version: string;
            role: string;
            constraintAttachment: {
                dataflows: string[];
            };
            cubeRegions: {
                include: boolean;
                keyValues: {
                    id: string;
                    values: string[];
                }[];
            }[];
        }[];
        categorySchemes: {
            id: string;
            agencyID: string;
            version: string;
            names: {
                th: string;
            };
            categories: {
                id: string;
                names: {
                    th: string;
                };
            }[];
        }[];
        categorisations: {
            id: string;
            agencyID: string;
            version: string;
            source: string;
            target: string;
        }[];
    };
};
export declare const REPORT_WITH_ERRORS: {
    Status: string;
    Errors: boolean;
    FileFormat: string;
    PreventsConversion: boolean;
    PreventsPublication: boolean;
    Datasets: {
        Dataflow: string;
        KeysCount: number;
        ObsCount: number;
        Errors: boolean;
        ValidationReport: {
            Type: string;
            Errors: {
                Message: string;
                Dataset: number;
                ComponentId: string;
                ReportedValue: string;
                Position: string;
                Keys: string[];
            }[];
        }[];
    }[];
};
