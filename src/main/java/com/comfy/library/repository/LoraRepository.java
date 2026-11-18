package com.comfy.library.repository;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import com.comfy.library.dto.lora.LoraFilterMetadata;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoraRepository extends JpaRepository<LoraEntity, Long>, JpaSpecificationExecutor<LoraEntity> {
    List<LoraEntity> findByArchivedFalse();
    Page<LoraEntity> findByArchivedFalse(Pageable pageable);
    Page<LoraEntity> findByArchivedTrue(Pageable pageable);
    @Query("select distinct new com.comfy.library.dto.lora.LoraFilterMetadata(l.baseModel, l.category, l.subCategory) from LoraEntity l where l.archived = false")
    List<LoraFilterMetadata> findFilterMetadata();
    List<LoraEntity> findAllByLoraNameAndVersionAndCreator(String loraName, String version, String creator);
    List<LoraEntity> findAllBySha256(String sha256);
    List<LoraEntity> findAllByUrl(String url);

    boolean existsByLoraNameAndVersionAndCreator(String loraName, String version, String creator);



    Page<LoraEntity> findByCategoryAndArchivedFalse(LoraCategory category, Pageable pageable);

    Page<LoraEntity> findByGroupNameIgnoreCaseAndArchivedFalse(String groupName, Pageable pageable);

    Page<LoraEntity> findByFavoriteTrueAndArchivedFalse(Pageable pageable);

    Page<LoraEntity> findByLoraNameContainingIgnoreCase(String keyword, Pageable pageable);

    List<LoraEntity> findAllByOrderByGroupNameAsc();

    boolean existsBySha256(String sha256);

    Optional<LoraEntity> findBySha256(String sha256);

    boolean existsByLoraNameAndVersion(String loraName, String version);
}
